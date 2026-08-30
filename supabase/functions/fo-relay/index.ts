// Relays field order changes to the partner team's HTTPS endpoint.
//
// Flow:  row change -> Database Webhook (api_setup.sql) -> here -> partner
//
// This sits in the middle rather than pointing the webhook straight at the
// partner for three reasons:
//   1. a raw webhook posts the WHOLE row, including crew payroll and billed
//      amounts — SHARED_COLUMNS below is the only thing keeping those in;
//   2. the sector exists only in the table name, so it has to be attached here;
//   3. a failed delivery can be logged for replay instead of vanishing.
//
// Secrets (Edge Function settings):
//   RELAY_SECRET           shared with the DB trigger; rejects anything else
//   PARTNER_WEBHOOK_URL    where to POST
//   PARTNER_SIGNING_SECRET HMAC key so the partner can verify it is really us

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RELAY_SECRET = Deno.env.get('RELAY_SECRET') ?? ''
const PARTNER_WEBHOOK_URL = Deno.env.get('PARTNER_WEBHOOK_URL') ?? ''
const PARTNER_SIGNING_SECRET = Deno.env.get('PARTNER_SIGNING_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// Each sector has its own table; the sector is implied by the table name.
const SECTOR_BY_TABLE: Record<string, string> = {
  field_orders: 'rizal',
  field_orders_manila: 'manila',
  field_orders_pasig: 'pasig',
  field_orders_balintawak: 'balintawak',
}

// EXACTLY what leaves this system. Commercial figures (billed_amount,
// crew_payrol, percentage) are deliberately omitted — add them here only if
// the partner is meant to see money.
const SHARED_COLUMNS = [
  'id',
  'field_order_no',
  'service_number',
  'status_crew',
  'fo_action',
  'fo_type',
  'job_description',
  'type_of_meter',
  'crew_name',
  'location',
  'date_assign',
  'date_executed',
  'date_returned',
  'witness_date',
  'remove_meter',
  'r_serial_number',
  'ins_meter',
  'ins_serial_number',
  'aging',
  'for_batch',
  'remarks',
  'archived_at',
  'created_at',
  'updated_at',
]

type WebhookEvent = {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  record: Record<string, unknown> | null
  old_record: Record<string, unknown> | null
}

function pickShared(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const key of SHARED_COLUMNS) {
    if (key in row) out[key] = row[key]
  }
  return out
}

async function hmacHex(body: string, secret: string) {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async req => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  // Only our own database trigger may invoke this.
  if (!RELAY_SECRET || req.headers.get('x-relay-secret') !== RELAY_SECRET) {
    return new Response('Forbidden', { status: 403 })
  }

  let event: WebhookEvent
  try {
    event = await req.json()
  } catch {
    return new Response('Bad request', { status: 400 })
  }

  const sector = SECTOR_BY_TABLE[event.table]
  if (!sector) {
    // A table we do not share. Acknowledge so the trigger is not retried.
    return new Response('Ignored', { status: 200 })
  }

  // On DELETE the new row is null and the deleted row arrives as old_record.
  const row = event.record ?? event.old_record ?? {}

  const payload = {
    event: event.type,
    sector,
    occurred_at: new Date().toISOString(),
    field_order: pickShared(row),
  }
  const body = JSON.stringify(payload)

  let signature = ''
  if (PARTNER_SIGNING_SECRET) {
    signature = await hmacHex(body, PARTNER_SIGNING_SECRET)
  }

  try {
    const response = await fetch(PARTNER_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MBDEVS-Signature': signature,
        'X-MBDEVS-Event': event.type,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    })

    if (!response.ok) {
      throw new Error(`partner responded ${response.status}`)
    }
  } catch (error) {
    // Never lose the change: park it so it can be replayed. Returning 200
    // keeps the failure out of Postgres — the trigger cannot retry anyway.
    try {
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
      await admin.from('relay_failures').insert({
        sector,
        event_type: event.type,
        payload,
        error: String(error),
      })
    } catch (logError) {
      console.error('could not record relay failure', logError)
    }
    console.error(`relay to partner failed (${sector} ${event.type})`, error)
    return new Response('Logged for replay', { status: 202 })
  }

  return new Response('ok', { status: 200 })
})
