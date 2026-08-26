import 'reflect-metadata';
import { Issuer } from 'openid-client';
import passport from 'passport';
import { OidcProviderRegistry } from './oidc-provider.registry';
import { NO_ROLE, OidcIdpBootstrapper, USER_NOT_FOUND } from './oidc.strategy';

jest.mock('config', () => ({
  FE_URL: 'http://frontend',
  MY_URL_API_PATH: 'http://adminapp/api',
  USE_PKCE: false,
  // Kept small so the discovery-timeout test resolves quickly
  OIDC_DISCOVERY_TIMEOUT_MS: 50,
}));

const keycloakOidcRow = {
  id: 1,
  issuer: 'http://keycloak/realms/edfi',
  clientId: 'adminapp-client',
  clientSecret: 'secret',
  scope: 'openid profile email',
};

const googleOidcRow = {
  id: 2,
  issuer: 'https://accounts.google.com',
  clientId: 'google-client',
  clientSecret: 'secret',
  scope: 'openid profile email',
};

const keycloakIssuer = new Issuer({
  issuer: 'http://keycloak/realms/edfi',
  authorization_endpoint: 'http://keycloak/realms/edfi/protocol/openid-connect/auth',
  token_endpoint: 'http://keycloak/realms/edfi/protocol/openid-connect/token',
  userinfo_endpoint: 'http://keycloak/realms/edfi/protocol/openid-connect/userinfo',
  jwks_uri: 'http://keycloak/realms/edfi/protocol/openid-connect/certs',
  end_session_endpoint: 'http://keycloak/realms/edfi/protocol/openid-connect/logout',
});

// Google does not expose an end_session_endpoint in its discovery document
const googleIssuer = new Issuer({
  issuer: 'https://accounts.google.com',
  authorization_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  token_endpoint: 'https://oauth2.googleapis.com/token',
  userinfo_endpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
  jwks_uri: 'https://www.googleapis.com/oauth2/v3/certs',
});

describe('OidcIdpBootstrapper', () => {
  let registry: OidcProviderRegistry;
  let passportUseSpy: jest.SpyInstance;

  const bootstrap = async (rows: unknown[], authService: unknown = {}): Promise<void> => {
    registry = new OidcProviderRegistry();
    const oidcRepo = { find: jest.fn().mockResolvedValue(rows) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const bootstrapper = new OidcIdpBootstrapper(oidcRepo as any, authService as any, registry);
    await bootstrapper.onModuleInit();
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    passportUseSpy = jest.spyOn(passport, 'use').mockImplementation(() => passport);
    jest.spyOn(Issuer, 'discover').mockImplementation((url: string) => {
      if (url.startsWith(keycloakOidcRow.issuer)) {
        return Promise.resolve(keycloakIssuer);
      }
      if (url.startsWith(googleOidcRow.issuer)) {
        return Promise.resolve(googleIssuer);
      }
      return Promise.reject(new Error(`Unexpected discovery URL: ${url}`));
    });
  });

  it('registers a passport strategy per configured provider', async () => {
    await bootstrap([keycloakOidcRow, googleOidcRow]);

    expect(passportUseSpy).toHaveBeenCalledWith('oidc-1', expect.any(Object));
    expect(passportUseSpy).toHaveBeenCalledWith('oidc-2', expect.any(Object));
  });

  it('populates the registry so registered providers are queryable', async () => {
    await bootstrap([keycloakOidcRow, googleOidcRow]);

    expect(registry.getEndSessionUrl(keycloakOidcRow.id, 'token')).not.toBeNull();
    expect(registry.getEndSessionUrl(googleOidcRow.id, 'token')).toBeNull();
  });

  describe('when discovery fails for one of several configured providers', () => {
    beforeEach(() => {
      jest.spyOn(Issuer, 'discover').mockImplementation((url: string) => {
        if (url.startsWith(keycloakOidcRow.issuer)) {
          return Promise.resolve(keycloakIssuer);
        }
        return Promise.reject(new Error('discovery unavailable'));
      });
    });

    it('still registers the providers that discovered successfully', async () => {
      await bootstrap([keycloakOidcRow, googleOidcRow]);

      expect(passportUseSpy).toHaveBeenCalledWith('oidc-1', expect.any(Object));
      expect(passportUseSpy).not.toHaveBeenCalledWith('oidc-2', expect.any(Object));
    });

    it('records the failed provider so it is not inferred as the sole one', async () => {
      await bootstrap([keycloakOidcRow, googleOidcRow]);

      expect(registry.getFailedProviderIds()).toEqual([googleOidcRow.id]);
      expect(registry.getSoleOidcId()).toBeUndefined();
    });
  });

  describe('when a provider hangs during discovery', () => {
    beforeEach(() => {
      jest.spyOn(Issuer, 'discover').mockImplementation((url: string) => {
        if (url.startsWith(keycloakOidcRow.issuer)) {
          return Promise.resolve(keycloakIssuer);
        }
        // Never resolves: exercises the per-provider discovery timeout
        return new Promise(() => undefined);
      });
    });

    it('skips the unresponsive provider and still registers the healthy one', async () => {
      await bootstrap([keycloakOidcRow, googleOidcRow]);

      expect(passportUseSpy).toHaveBeenCalledWith('oidc-1', expect.any(Object));
      expect(passportUseSpy).not.toHaveBeenCalledWith('oidc-2', expect.any(Object));
    });
  });

  describe('the verify callback', () => {
    const userinfo = { email: 'teacher@example.org' };

    const captureVerify = async (validateUser: jest.Mock) => {
      await bootstrap([keycloakOidcRow], { validateUser });
      const strategy = passportUseSpy.mock.calls.find((call) => call[0] === 'oidc-1')?.[1];
      // openid-client stores the verify function on the strategy instance
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (strategy as any)._verify as (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        tokenset: any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        userinfo: any,
        done: jest.Mock
      ) => Promise<void>;
    };

    it('passes the id_token along when the user is valid', async () => {
      const verify = await captureVerify(
        jest.fn().mockResolvedValue({ roleId: 5, userTeamMemberships: [{}] })
      );
      const done = jest.fn();

      await verify({ id_token: 'the-id-token' }, userinfo, done);

      expect(done).toHaveBeenCalledWith(null, expect.objectContaining({ roleId: 5 }), {
        idToken: 'the-id-token',
      });
    });

    it('fails with USER_NOT_FOUND when the user does not exist', async () => {
      const verify = await captureVerify(jest.fn().mockResolvedValue(null));
      const done = jest.fn();

      await verify({ id_token: 'tok' }, userinfo, done);

      expect(done).toHaveBeenCalledWith(expect.objectContaining({ message: USER_NOT_FOUND }), false);
    });

    it('fails with NO_ROLE when the user has no role assigned', async () => {
      const verify = await captureVerify(jest.fn().mockResolvedValue({ roleId: null }));
      const done = jest.fn();

      await verify({ id_token: 'tok' }, userinfo, done);

      expect(done).toHaveBeenCalledWith(expect.objectContaining({ message: NO_ROLE }), false);
    });

    it('maps a validateUser failure to a database error', async () => {
      const verify = await captureVerify(jest.fn().mockRejectedValue(new Error('connection refused')));
      const done = jest.fn();

      await verify({ id_token: 'tok' }, userinfo, done);

      expect(done).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Database connection error during authentication' }),
        false
      );
    });

    it('rejects when the IdP returns no email', async () => {
      const verify = await captureVerify(jest.fn());
      const done = jest.fn();

      await expect(verify({ id_token: 'tok' }, { email: '' }, done)).rejects.toThrow(
        'Invalid email from IdP'
      );
      expect(done).not.toHaveBeenCalled();
    });
  });
});
