import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  callbackRedirectUri,
  getKeycloak,
  initKeycloak,
  postLogoutRedirectUri,
} from './keycloak'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [authenticated, setAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [initError, setInitError] = useState('')

  useEffect(() => {
    let cancelled = false
    const kc = getKeycloak()

    const sync = () => {
      if (!cancelled) setAuthenticated(!!kc.authenticated)
    }

    initKeycloak()
      .then((auth) => {
        if (cancelled) return
        setAuthenticated(!!auth)
        setInitError('')
      })
      .catch((e) => {
        if (cancelled) return
        setAuthenticated(false)
        setInitError(e?.message || 'Keycloak init failed')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    kc.onAuthSuccess = sync
    kc.onAuthLogout = () => {
      if (!cancelled) setAuthenticated(false)
    }
    kc.onAuthRefreshSuccess = sync
    kc.onAuthRefreshError = () => {
      if (!cancelled) setAuthenticated(false)
    }
    // Proactive refresh when the access token hits expiry (F3).
    kc.onTokenExpired = () => {
      kc.updateToken(30).then(sync).catch(() => {
        if (!cancelled) setAuthenticated(false)
      })
    }

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(() => {
    return getKeycloak().login({ redirectUri: callbackRedirectUri() })
  }, [])

  const signup = useCallback(() => {
    return getKeycloak().register({ redirectUri: callbackRedirectUri() })
  }, [])

  const logout = useCallback(() => {
    return getKeycloak().logout({ redirectUri: postLogoutRedirectUri() })
  }, [])

  const getAccessToken = useCallback(async () => {
    const kc = getKeycloak()
    if (!kc.authenticated) return null
    try {
      // Refresh if the token expires within 30 seconds.
      await kc.updateToken(30)
    } catch {
      return null
    }
    return kc.token || null
  }, [])

  const value = useMemo(
    () => ({
      authenticated,
      loading,
      initError,
      login,
      signup,
      logout,
      getAccessToken,
    }),
    [authenticated, loading, initError, login, signup, logout, getAccessToken],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
