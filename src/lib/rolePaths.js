// Where each account type belongs. One place, so the post-login redirect,
// the role guards and the sidebar cannot disagree about where an account
// should land.

// Every account works in the app itself and picks a sector first. What each
// one may do is expressed by the tabs the sidebar offers, not by sending
// them somewhere different — a separate landing page per role was one more
// screen between someone and their work.
export const ROLE_HOME = {
  super_admin: '/sectors',
  admin: '/sectors',
  encoder: '/sectors',
  viewer: '/sectors',
}

// An account whose type we do not recognise still has to go somewhere.
// /sectors is the ordinary app, which every signed-in user can open at
// whatever permission level they actually hold.
export const FALLBACK_HOME = '/sectors'

export function pathForAccountType(accountType) {
  return ROLE_HOME[accountType] || FALLBACK_HOME
}

