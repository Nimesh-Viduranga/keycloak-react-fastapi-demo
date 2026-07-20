import { UserManager, WebStorageStateStore } from 'oidc-client-ts'

const authority =
  import.meta.env.VITE_KEYCLOAK_AUTHORITY ||
  'http://localhost:8090/realms/brandvisual'

const clientId = import.meta.env.VITE_CLIENT_ID || 'react-fastapi-demo'

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
