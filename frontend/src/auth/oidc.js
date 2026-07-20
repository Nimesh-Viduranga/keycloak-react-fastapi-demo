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
 * Point discovery metadata at Keycloak registrations, then run normal PKCE sign-in.
 * Restores the authorize endpoint if redirect setup fails.
 */
export async function signinViaRegistration(userManager) {
  const meta = await userManager.metadataService.getMetadata()
  const original = meta.authorization_endpoint
  meta.authorization_endpoint = original.replace(
    '/protocol/openid-connect/auth',
    '/protocol/openid-connect/registrations',
  )
  try {
    await userManager.signinRedirect()
  } catch (err) {
    meta.authorization_endpoint = original
    throw err
  }
}
