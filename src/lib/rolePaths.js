// Where each account type belongs. One place, so the post-login redirect,
// the role guards and the sidebar cannot disagree about where an account
// should land.

export const ROLE_HOME = {
  super_admin: '/super-admin',
  admin: '/admin',
  supervisor: '/supervisor',
  encoder: '/encoder',
  viewer: '/viewer',
}

// An account whose type we do not recognise still has to go somewhere.
// /sectors is the ordinary app, which every signed-in user can open at
// whatever permission level they actually hold.
export const FALLBACK_HOME = '/sectors'

export function pathForAccountType(accountType) {
  return ROLE_HOME[accountType] || FALLBACK_HOME
}

// The role dashboards are keyed with a hyphen in roleDashboards.js, while
// account_type uses an underscore (it is a Postgres value).
export function dashboardKeyFor(accountType) {
  return accountType === 'super_admin' ? 'super-admin' : accountType
}
