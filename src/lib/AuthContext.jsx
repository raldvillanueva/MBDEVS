import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(undefined)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined) // undefined = not yet resolved
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)

  const fetchProfile = useCallback(async (userId) => {
    if (!userId) { setProfile(null); setProfileLoading(false); return }
    setProfileLoading(true)

    // select('*') rather than a column list on purpose. Naming a column that
    // does not exist yet fails the whole query, which lands here as "no
    // profile" and silently demotes every admin to staff — a migration
    // arriving after a deploy should not be able to strip privileges.
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      // Swallowing this is what made the demotion invisible last time.
      console.error('Could not load profile — falling back to least privilege', error)
    }

    setProfile(data || null)
    setProfileLoading(false)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (session === undefined) return
    fetchProfile(session?.user?.id)
  }, [session, fetchProfile])

  const loading = session === undefined || profileLoading

  const role = profile?.role || 'staff' // fail-closed: unknown/unfetched profile => least privilege

  // Admin/Supervisor/Super Admin and Encoder/Viewer are all real accounts
  // under the hood ('admin' or 'staff' respectively) — account_type just
  // says which of the two page variants within that bucket to show.
  // Falls back sensibly for profile rows created before this column existed.
  const accountType = profile?.account_type || (role === 'admin' ? 'admin' : 'encoder')

  // Capability flags, mirroring the SQL helpers in role_permissions_setup.sql
  // one for one. These only decide what the UI offers — the database enforces
  // the same rules, so hiding a button is a courtesy, not the control.
  const canEncode = ['encoder', 'supervisor', 'admin', 'super_admin'].includes(accountType)
  const canManage = ['supervisor', 'admin', 'super_admin'].includes(accountType)
  const canDelete = ['admin', 'super_admin'].includes(accountType)
  const isSuperAdmin = accountType === 'super_admin'

  const value = {
    session,
    profile,
    role,
    accountType,
    canEncode,
    canManage,
    canDelete,
    isSuperAdmin,
    loading,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
