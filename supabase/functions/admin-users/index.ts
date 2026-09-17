// Creates sign-ins for the Super Admin "Create Account" flow.
//
// Creating a Supabase user needs auth.admin.createUser, which needs the
// service role key — and that key bypasses every RLS policy, so it can never
// ship to a browser. This function holds it server-side instead: the page
// sends the signed-in user's own token, and the function decides whether that
// person is allowed to create accounts.
//
// POST /functions/v1/admin-users
//   Authorization: Bearer <the caller's access token>
//   { email, password, full_name, account_type }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// account_type decides what the app shows; role is the coarse bucket RLS
// reads. They are set together here so an account can never end up showing
// supervisor pages while the database treats it as staff.
const ACCOUNT_TYPES: Record<string, 'admin' | 'staff'> = {
  super_admin: 'admin',
  admin: 'admin',
  supervisor: 'admin',
  encoder: 'staff',
  viewer: 'staff',
}

// The browser calls this directly, so it needs CORS. Only the app's own
// origin is allowed — this endpoint creates accounts, and any page on the
// internet being able to invoke it is not a risk worth taking for
// convenience.
const ALLOWED_ORIGINS = [
  'https://mbdevs-theta.vercel.app',
  'http://localhost:5173',
]

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, content-type',
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

Deno.serve(async req => {
  const origin = req.headers.get('origin')

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(origin) })
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, origin)
  }

  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) {
    return json({ error: 'Not signed in' }, 401, origin)
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // Who is asking? The token is verified by Supabase, not trusted from the body.
  const { data: caller, error: callerError } = await admin.auth.getUser(token)
  if (callerError || !caller?.user) {
    return json({ error: 'Not signed in' }, 401, origin)
  }

  // And are they allowed to do this? Checked server-side: the client could
  // claim any account_type it liked.
  const { data: callerProfile } = await admin
    .from('profiles')
    .select('account_type')
    .eq('id', caller.user.id)
    .maybeSingle()

  // Creating accounts is Super Admin work. This has to hold here and not
  // only in the UI: the browser guard decides what is shown, this decides
  // what is allowed, and anyone can send this request by hand.
  if (callerProfile?.account_type !== 'super_admin') {
    return json({ error: 'Only a Super Admin can create accounts' }, 403, origin)
  }

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Bad request' }, 400, origin)
  }

  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  const fullName = (body.full_name ?? '').trim()
  const accountType = body.account_type ?? ''

  if (!email || !password) {
    return json({ error: 'Email and password are required' }, 400, origin)
  }
  if (password.length < 8) {
    return json({ error: 'Password must be at least 8 characters' }, 400, origin)
  }
  if (!(accountType in ACCOUNT_TYPES)) {
    return json({ error: `account_type must be one of ${Object.keys(ACCOUNT_TYPES).join(', ')}` }, 400, origin)
  }

  // email_confirm: true — an admin creating an account on someone's behalf has
  // already vouched for the address, and the project's email sending is rate
  // limited, so a confirmation step would strand people at "check your inbox".
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError || !created?.user) {
    const message = createError?.message ?? 'Could not create the account'
    const alreadyExists = /already|registered|duplicate/i.test(message)
    return json(
      { error: alreadyExists ? 'An account with that email already exists' : message },
      alreadyExists ? 409 : 400,
      origin,
    )
  }

  // handle_new_user has already inserted the profile row as encoder/staff;
  // this promotes it to whatever was asked for.
  const { error: profileError } = await admin
    .from('profiles')
    .update({
      full_name: fullName || null,
      email,
      account_type: accountType,
      role: ACCOUNT_TYPES[accountType],
    })
    .eq('id', created.user.id)

  if (profileError) {
    // The sign-in exists but carries the default permissions. Say so plainly
    // rather than reporting success — a silently-encoder "supervisor" account
    // is worse than a clear error.
    return json({
      error:
        'The sign-in was created, but its role could not be set. ' +
        'Assign it from Manage Users.',
      user_id: created.user.id,
    }, 500, origin)
  }

  return json({
    user_id: created.user.id,
    email,
    account_type: accountType,
  }, 201, origin)
})
