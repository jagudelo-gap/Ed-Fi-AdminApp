import 'reflect-metadata';
import { Issuer } from 'openid-client';
import { OidcProviderRegistry } from './oidc-provider.registry';

jest.mock('config', () => ({
  MY_URL_API_PATH: 'http://adminapp/api',
}));

const keycloakIssuer = new Issuer({
  issuer: 'http://keycloak/realms/edfi',
  authorization_endpoint: 'http://keycloak/realms/edfi/protocol/openid-connect/auth',
  token_endpoint: 'http://keycloak/realms/edfi/protocol/openid-connect/token',
  jwks_uri: 'http://keycloak/realms/edfi/protocol/openid-connect/certs',
  end_session_endpoint: 'http://keycloak/realms/edfi/protocol/openid-connect/logout',
});

// Google does not expose an end_session_endpoint in its discovery document
const googleIssuer = new Issuer({
  issuer: 'https://accounts.google.com',
  authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  token_endpoint: 'https://oauth2.googleapis.com/token',
  jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
});

const keycloakClient = new keycloakIssuer.Client({
  client_id: 'adminapp-client',
  client_secret: 'secret',
});
const googleClient = new googleIssuer.Client({
  client_id: 'google-client',
  client_secret: 'secret',
});

describe('OidcProviderRegistry', () => {
  let registry: OidcProviderRegistry;

  beforeEach(() => {
    registry = new OidcProviderRegistry();
  });

  describe('getSoleOidcId', () => {
    it('returns undefined when no providers are registered', () => {
      registry.setConfiguredProviderCount(0);

      expect(registry.getSoleOidcId()).toBeUndefined();
    });

    it('returns the sole provider id when exactly one is configured and registered', () => {
      registry.setConfiguredProviderCount(1);
      registry.register(1, keycloakClient);

      expect(registry.getSoleOidcId()).toBe(1);
    });

    it('returns undefined when more than one provider is registered', () => {
      registry.setConfiguredProviderCount(2);
      registry.register(1, keycloakClient);
      registry.register(2, googleClient);

      expect(registry.getSoleOidcId()).toBeUndefined();
    });

    it('returns undefined when a second configured provider failed to register', () => {
      // One provider was configured but did not register; the survivor must not
      // be assumed to be the one a legacy (untracked) session logged in with.
      registry.setConfiguredProviderCount(2);
      registry.register(1, keycloakClient);
      registry.markFailed(2);

      expect(registry.getSoleOidcId()).toBeUndefined();
    });
  });

  describe('getEndSessionUrl', () => {
    beforeEach(() => {
      registry.setConfiguredProviderCount(2);
      registry.register(1, keycloakClient);
      registry.register(2, googleClient);
    });

    it('builds the logout URL from the discovered end_session_endpoint', () => {
      const url = registry.getEndSessionUrl(1, 'the-id-token');

      expect(url).not.toBeNull();
      const parsed = new URL(url as string);
      expect(`${parsed.origin}${parsed.pathname}`).toBe(
        'http://keycloak/realms/edfi/protocol/openid-connect/logout'
      );
      expect(parsed.searchParams.get('id_token_hint')).toBe('the-id-token');
      expect(parsed.searchParams.get('post_logout_redirect_uri')).toBe(
        'http://adminapp/api/auth/post-logout'
      );
      expect(parsed.searchParams.get('client_id')).toBe('adminapp-client');
    });

    it('omits id_token_hint when no id_token is available', () => {
      const url = registry.getEndSessionUrl(1);

      const parsed = new URL(url as string);
      expect(parsed.searchParams.has('id_token_hint')).toBe(false);
      expect(parsed.searchParams.get('client_id')).toBe('adminapp-client');
    });

    it('returns null for a provider without an end_session_endpoint', () => {
      expect(registry.getEndSessionUrl(2, 'the-id-token')).toBeNull();
    });

    it('returns null for an unregistered provider id', () => {
      expect(registry.getEndSessionUrl(999, 'the-id-token')).toBeNull();
    });
  });

  describe('failure tracking', () => {
    it('reports failed provider ids and clears them', () => {
      registry.markFailed(3);
      registry.markFailed(4);
      expect(registry.getFailedProviderIds()).toEqual([3, 4]);

      registry.clearFailures();
      expect(registry.getFailedProviderIds()).toEqual([]);
    });
  });
});
