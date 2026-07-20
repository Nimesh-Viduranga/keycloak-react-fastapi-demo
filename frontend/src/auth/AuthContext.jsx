import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { createUserManager, signinViaRegistration } from './oidc'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const userManager = useMemo(() => createUserManager(), [])
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    userManager
      .getUser()
      .then((u) => {
        if (!cancelled) setUser(u && !u.expired ? u : null)
      })
      .catch(() => {
        if (!cancelled) setUser(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    const onUserLoaded = (u) => setUser(u)
    const onUserUnloaded = () => setUser(null)
    userManager.events.addUserLoaded(onUserLoaded)
    userManager.events.addUserUnloaded(onUserUnloaded)

    return () => {
      cancelled = true
      userManager.events.removeUserLoaded(onUserLoaded)
      userManager.events.removeUserUnloaded(onUserUnloaded)
    }
  }, [userManager])

  const login = useCallback(() => userManager.signinRedirect(), [userManager])

  const signup = useCallback(
    () => signinViaRegistration(userManager),
    [userManager],
  )

  const completeLogin = useCallback(async () => {
    const u = await userManager.signinRedirectCallback()
    setUser(u)
    return u
  }, [userManager])

  const logout = useCallback(() => userManager.signoutRedirect(), [userManager])

  const getAccessToken = useCallback(async () => {
    const u = await userManager.getUser()
    if (!u || u.expired) return null
    return u.access_token
  }, [userManager])

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      signup,
      logout,
      completeLogin,
      getAccessToken,
    }),
    [user, loading, login, signup, logout, completeLogin, getAccessToken],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
