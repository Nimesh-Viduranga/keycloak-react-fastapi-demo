import { UserManager, WebStorageStateStore } from 'oidc-client-ts'

// Public OIDC settings from Vite env (frontend/.env or Docker build args).
// Never put a client secret here — this client is public.
const authority = import.meta.env.VITE_KEYCLOAK_AUTHORITY
const clientId = import.meta.env.VITE_CLIENT_ID

if (!authority || !clientId) {
  throw new Error(
    'Missing VITE_KEYCLOAK_AUTHORITY or VITE_CLIENT_ID. Copy frontend/.env.example to frontend/.env',
  )
}

export function createUserManager() {
  const origin = window.location.origin
  return new UserManager({
    authority,
    client_id: clientId,
    redirect_uri: `${origin}/callback`,
    post_logout_redirect_uri: `${origin}/`,
    response_type: 'code',
    scope: 'openid email profile',
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
    automaticSilentRenew: true,
  })
}

/**
 * Start sign-up. Uses the standard OIDC `prompt=create` parameter (Keycloak 25+),
 * which lands the user on the registration page while running the same
 * authorization-code + PKCE flow. No discovery-metadata mutation required.
 */
export function signinViaRegistration(userManager) {
  return userManager.signinRedirect({ extraQueryParams: { prompt: 'create' } })
}
