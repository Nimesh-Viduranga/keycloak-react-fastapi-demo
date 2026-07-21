import Keycloak from 'keycloak-js'

// Public Keycloak settings from Vite env (frontend/.env or Docker build args).
// Never put a client secret here — this client is public.
const url = import.meta.env.VITE_KEYCLOAK_URL
const realm = import.meta.env.VITE_KEYCLOAK_REALM
const clientId = import.meta.env.VITE_CLIENT_ID

if (!url || !realm || !clientId) {
  throw new Error(
    'Missing VITE_KEYCLOAK_URL, VITE_KEYCLOAK_REALM, or VITE_CLIENT_ID. Copy frontend/.env.example to frontend/.env',
  )
}

/** @type {Keycloak | null} */
let keycloak = null
/** @type {Promise<boolean> | null} */
let initPromise = null

export function getKeycloak() {
  if (!keycloak) {
    keycloak = new Keycloak({ url, realm, clientId })
  }
  return keycloak
}

export function callbackRedirectUri() {
  return `${window.location.origin}/callback`
}

export function postLogoutRedirectUri() {
  return `${window.location.origin}/`
}

/**
 * Init once (module latch). Safe under React StrictMode double-mount.
 * When the browser lands on /callback?code=..., init exchanges the code via PKCE.
 *
 * Do not use onLoad: 'check-sso' here — with checkLoginIframe disabled it redirects
 * the whole page to Keycloak with redirect_uri=current URL (e.g. /), which is not
 * in the client's allowed redirect URIs (/callback only).
 */
export function initKeycloak() {
  if (!initPromise) {
    const kc = getKeycloak()
    initPromise = kc
      .init({
        pkceMethod: 'S256',
        checkLoginIframe: false,
      })
      .catch((err) => {
        // Allow a retry after a hard failure (e.g. transient network).
        initPromise = null
        throw err
      })
  }
  return initPromise
}
