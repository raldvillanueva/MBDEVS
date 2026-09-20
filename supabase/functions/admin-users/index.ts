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
//   { username, email, password, full_name, account_type, sector? }
//
// PATCH /functions/v1/admin-users    edit an existing account
//   Authorization: Bearer <the caller's access token>
//   { user_id, username?, full_name?, email?, password?, sector? }
//
// sector restricts the account to one sector ('rizal' | 'manila' |
// 'pasig' | 'balintawak' | 'ami'). Omitted or '' means unrestricted — every
// sector stays open, same as before this field existed.
//
// There is no "read the password" here, and there cannot be: Supabase
// stores a bcrypt hash, so the original is not recoverable by anyone —
// which is the point. Setting a new one is how a forgotten password is
// dealt with.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// account_type decides what the app shows; role is the coarse bucket RLS
// reads. They are set together here so an account can never end up showing
// admin pages while the database treats it as staff.
const ACCOUNT_TYPES: Record<string, 'admin' | 'staff'> = {
  super_admin: 'admin',
  admin: 'admin',
  encoder: 'staff',
  viewer: 'staff',
}

// Mirrors DATA_SECTORS in src/lib/sectorTables.js. mbdevco is deliberately
// left out — it's the rollup every account can already reach, not
// something an account is restricted into.
const VALID_SECTORS = new Set(['rizal', 'manila', 'pasig', 'balintawak', 'ami'])

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
    // PATCH has to be listed or the browser's preflight rejects the edit and
    // reset calls before they are ever sent, which surfaces as a connection
    // failure rather than anything server-side.
    'Access-Control-Allow-Methods': 'POST, PATCH, OPTIONS',
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

  if (req.method !== 'POST' && req.method !== 'PATCH') {
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
    return json({ error: 'Only a Super Admin can manage accounts' }, 403, origin)
  }

  let body: Record<string, string>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Bad request' }, 400, origin)
  }

  // Username uniqueness, shared by create and edit. exceptId lets an account
  // keep its own username when something else about it is being changed.
  async function usernameTaken(name: string, exceptId?: string) {
    let q = admin.from('profiles').select('id').ilike('username', name)
    if (exceptId) q = q.neq('id', exceptId)
    const { data } = await q.maybeSingle()
    return !!data
  }

  // ---- PATCH: edit an existing account ----
  //
  // Every field is optional: the client sends only what changed. A field
  // that is absent is left alone, which is not the same as a field sent
  // empty — that would blank it.
  if (req.method === 'PATCH') {
    const userId = (body.user_id ?? '').trim()

    if (!userId) {
      return json({ error: 'user_id is required' }, 400, origin)
    }

    const patch: Record<string, string | null> = {}

    if (typeof body.username === 'string') {
      const next = body.username.trim()
      // Mirrors profiles_username_format. Checked here as well so a clash
      // comes back as a sentence rather than a database error.
      if (!/^[^@\s]{3,32}$/.test(next)) {
        return json({ error: 'Username must be 3-32 characters, with no spaces or @' }, 400, origin)
      }
      if (await usernameTaken(next, userId)) {
        return json({ error: `Username ${next} is already taken` }, 409, origin)
      }
      patch.username = next
    }

    if (typeof body.full_name === 'string') {
      patch.full_name = body.full_name.trim() || null
    }

    // The email lives in two places: auth.users, which is where a reset link
    // or a one-time code would be sent, and profiles, which is what the app
    // reads. They move together or the account ends up with two different
    // addresses and no sign of which one is real.
    if (typeof body.email === 'string' && body.email.trim()) {
      const nextEmail = body.email.trim().toLowerCase()
      const { error: emailError } = await admin.auth.admin.updateUserById(userId, {
        email: nextEmail,
        email_confirm: true,
      })
      if (emailError) {
        const taken = /already|registered|duplicate/i.test(emailError.message)
        return json(
          { error: taken ? 'Another account already uses that email' : emailError.message },
          taken ? 409 : 400,
          origin,
        )
      }
      patch.email = nextEmail
    }

    if (typeof body.password === 'string' && body.password) {
      if (body.password.length < 8) {
        return json({ error: 'Password must be at least 8 characters' }, 400, origin)
      }
      const { error: passwordError } = await admin.auth.admin.updateUserById(userId, {
        password: body.password,
      })
      if (passwordError) {
        return json({ error: passwordError.message }, 400, origin)
      }
    }

    // '' clears the restriction back to "every sector" — that's a real,
    // intentional change, so it still has to go in patch, not be treated
    // as absent.
    if (typeof body.sector === 'string') {
      const next = body.sector.trim()
      if (next && !VALID_SECTORS.has(next)) {
        return json({ error: `sector must be one of ${[...VALID_SECTORS].join(', ')}, or empty` }, 400, origin)
      }
      patch.sector = next || null
    }

    if (Object.keys(patch).length > 0) {
      const { error: patchError } = await admin.from('profiles').update(patch).eq('id', userId)
      if (patchError) {
        return json({ error: patchError.message }, 400, origin)
      }
    }

    return json({ user_id: userId, updated: true }, 200, origin)
  }

  // ---- POST: create a new account ----
  const username = (body.username ?? '').trim()
  const email = (body.email ?? '').trim().toLowerCase()
  const password = body.password ?? ''
  const fullName = (body.full_name ?? '').trim()
  const accountType = body.account_type ?? ''
  const sector = (body.sector ?? '').trim() || null

  if (!username || !email || !password) {
    return json({ error: 'Username, email and password are required' }, 400, origin)
  }
  if (sector && !VALID_SECTORS.has(sector)) {
    return json({ error: `sector must be one of ${[...VALID_SECTORS].join(', ')}, or empty` }, 400, origin)
  }

  // Mirrors the profiles_username_format constraint. Checking here too
  // turns a database error into a sentence the person can act on.
  if (!/^[^@s]{3,32}$/.test(username)) {
    return json({ error: 'Username must be 3-32 characters, with no spaces or @' }, 400, origin)
  }

  // Rejected before the sign-in is created, so a clash does not leave an
  // orphaned auth user with no profile behind it.
  if (await usernameTaken(username)) {
    return json({ error: `Username ${username} is already taken` }, 409, origin)
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
      username,
      email,
      account_type: accountType,
      role: ACCOUNT_TYPES[accountType],
      sector,
    })
    .eq('id', created.user.id)

  if (profileError) {
    // The sign-in exists but carries the default permissions. Say so plainly
    // rather than reporting success — a silently-encoder "admin" account
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
    username,
    email,
    account_type: accountType,
    sector,
  }, 201, origin)
})
