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
    const { data } = await supabase.from('profiles').select('id, role, full_name, account_type').eq('id', userId).maybeSingle()
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

  const value = {
    session,
    profile,
    role,
    accountType,
    loading,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (ctx === undefined) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
