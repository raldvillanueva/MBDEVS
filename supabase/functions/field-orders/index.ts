// Read-only pull endpoint for the partner team.
//
// The real-time relay only covers changes from the moment it is switched on,
// and a webhook that fails is gone. This endpoint is the safety net: the
// initial backfill of existing records, reporting over a date range, and
// periodic reconciliation so a missed event heals itself instead of becoming
// a permanent gap.
//
// GET /functions/v1/field-orders
//     ?sector=      rizal | manila | pasig | balintawak
//     &date_from=   YYYY-MM-DD   inclusive
//     &date_to=     YYYY-MM-DD   inclusive
//     &date_field=  which date the range applies to (default date_executed)
//     &since=       ISO timestamp, updated_at >= since (for reconciliation)
//     &limit=       default 500, max 1000
//     &offset=      paging cursor
//   x-api-key: <PARTNER_API_KEY>
//
// Secrets (Edge Function settings):
//   PARTNER_API_KEY  the key handed to the partner team

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PARTNER_API_KEY = Deno.env.get('PARTNER_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// Must match SHARED_COLUMNS in fo-relay so push and pull agree on the shape.
// Commercial figures stay out of both.
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

const VALID_SECTORS = ['rizal', 'manila', 'pasig', 'balintawak']

// Whitelisted so date_field can never be used to probe columns we do not share.
const DATE_FIELDS = [
  'date_executed',
  'date_assign',
  'date_returned',
  'created_at',
  'updated_at',
]
const DEFAULT_DATE_FIELD = 'date_executed'

// created_at/updated_at carry a time; the plain date columns do not.
const TIMESTAMP_FIELDS = ['created_at', 'updated_at']

// PostgREST caps a response at 1000 rows regardless of what is asked for, so
// the ceiling is explicit here rather than silently truncating the caller.
const MAX_LIMIT = 1000
const DEFAULT_LIMIT = 500

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async req => {
  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405)
  }

  if (!PARTNER_API_KEY || req.headers.get('x-api-key') !== PARTNER_API_KEY) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const url = new URL(req.url)
  const sector = url.searchParams.get('sector')
  const since = url.searchParams.get('since')
  const dateFrom = url.searchParams.get('date_from')
  const dateTo = url.searchParams.get('date_to')
  const dateField = url.searchParams.get('date_field') ?? DEFAULT_DATE_FIELD

  const offset = Math.max(0, Number(url.searchParams.get('offset') ?? 0) || 0)
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT) || DEFAULT_LIMIT),
  )

  if (sector && !VALID_SECTORS.includes(sector)) {
    return json({ error: `sector must be one of ${VALID_SECTORS.join(', ')}` }, 400)
  }

  if (!DATE_FIELDS.includes(dateField)) {
    return json({ error: `date_field must be one of ${DATE_FIELDS.join(', ')}` }, 400)
  }

  for (const [name, value] of [['date_from', dateFrom], ['date_to', dateTo]]) {
    if (value && !DATE_ONLY.test(value)) {
      return json({ error: `${name} must be formatted YYYY-MM-DD` }, 400)
    }
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  let query = admin
    .from('all_field_orders')
    .select(['sector', ...SHARED_COLUMNS].join(','), { count: 'exact' })
    .order('updated_at', { ascending: true })
    // Tiebreaker: without it, rows sharing an updated_at come back in an
    // arbitrary order and offset paging can skip or repeat records.
    .order('id', { ascending: true })
    .range(offset, offset + limit - 1)

  if (sector) query = query.eq('sector', sector)

  // Inclusive range on the chosen date column.
  if (dateFrom) query = query.gte(dateField, dateFrom)
  if (dateTo) {
    // On a timestamp column "2026-08-30" means midnight, which would drop
    // almost the whole day the caller asked for. Stretch it to the day's end.
    const upperBound = TIMESTAMP_FIELDS.includes(dateField)
      ? `${dateTo}T23:59:59.999Z`
      : dateTo
    query = query.lte(dateField, upperBound)
  }

  // Reconciliation: everything touched since the caller's last successful sync.
  if (since) query = query.gte('updated_at', since)

  const { data, error, count } = await query

  if (error) {
    console.error('field-orders query failed', error)
    return json({ error: 'Query failed' }, 500)
  }

  const returned = data?.length ?? 0
  const nextOffset = offset + returned

  return json({
    data,
    filters: {
      sector: sector ?? 'all',
      date_field: dateField,
      date_from: dateFrom,
      date_to: dateTo,
      since,
    },
    pagination: {
      limit,
      offset,
      returned,
      total: count ?? null,
      // null means the caller has reached the end.
      next_offset: count !== null && nextOffset < count ? nextOffset : null,
    },
  })
})
