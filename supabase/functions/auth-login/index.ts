// Signs a person in with a username (MB0001) or, still, an email address.
//
// Supabase Auth is email/password underneath. Turning a username into an
// email has to happen somewhere, and doing it in the browser would mean
// shipping an endpoint that answers "what is MB0001's email address?" to
// anyone who asks — walk MB0001..MB9999 and you have harvested every
// address in the company. So the lookup happens here and the email is
// never part of a response.
//
// POST /functions/v1/auth-login
//   { identifier, password }          identifier = username or email
//   -> 200 { access_token, refresh_token }
//   -> 401 { error }                  same message whichever part was wrong

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

const ALLOWED_ORIGINS = [
  'https://mbdevs-theta.vercel.app',
  'http://localhost:5173',
]

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, content-type, apikey',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })
}

// One message for every failure. "No such username" and "wrong password"
// have to be indistinguishable, or this endpoint becomes a way to find out
// which usernames exist.
const REJECTED = 'Incorrect username or password.'

Deno.serve(async req => {
  const origin = req.headers.get('origin')

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, origin)
  }

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Bad request' }, 400, origin)
  }

  const identifier = (body.identifier ?? '').trim()
  const password = body.password ?? ''

  if (!identifier || !password) {
    return json({ error: REJECTED }, 401, origin)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  let email = identifier

  // An '@' means they typed an email, which Supabase takes as-is. Anything
  // else is a username and has to be looked up. Reading profiles for a
  // caller who is not signed in yet needs the service role, since RLS
  // would otherwise hide every row.
  const lookup = identifier.includes('@')
    ? admin.from('profiles').select('email, deactivated_at').ilike('email', identifier)
    : admin.from('profiles').select('email, deactivated_at').ilike('username', identifier)

  const { data: profile } = await lookup.maybeSingle()

  if (!identifier.includes('@')) {
    if (!profile?.email) {
      return json({ error: REJECTED }, 401, origin)
    }
    email = profile.email
  }

  // A deactivated or archived account keeps its password and its history;
  // what it loses is the ability to sign in. Checked before the password
  // so a disabled account cannot be told whether its password was right.
  //
  // Said plainly rather than hidden behind REJECTED: someone whose access
  // was withdrawn needs to know to go and ask, not to keep retyping a
  // password that is perfectly correct.
  if (profile?.deactivated_at) {
    return json(
      { error: 'This account has been deactivated. Ask a Super Admin to restore it.' },
      403,
      origin,
    )
  }

  // Sign in with the anon key, exactly as the browser would. The service
  // role is never used to mint a session: it bypasses RLS, and a bug here
  // would hand out access without a password ever being checked.
  const anon = createClient(SUPABASE_URL, ANON_KEY)
  const { data, error } = await anon.auth.signInWithPassword({ email, password })

  if (error || !data?.session) {
    return json({ error: REJECTED }, 401, origin)
  }

  // Only the tokens go back — never the email the username resolved to.
  return json({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  }, 200, origin)
})
