import { Injectable, Logger } from '@nestjs/common';
import config from 'config';
import { BaseClient } from 'openid-client';

/**
 * Holds the OIDC clients discovered at startup and answers the logout-related
 * queries the auth controller needs. This is a state/query surface only: it
 * performs no discovery or Passport wiring itself (see OidcIdpBootstrapper),
 * which keeps the controller from reaching into bootstrap internals.
 */
@Injectable()
export class OidcProviderRegistry {
  private readonly clients = new Map<number, BaseClient>();

  // Number of providers found in configuration, regardless of whether their
  // discovery/registration ultimately succeeded. Lets us tell "one provider
  // configured" apart from "one provider left standing after a failure".
  private configuredProviderCount = 0;

  // Ids of configured providers whose registration failed, so a broken provider
  // can be told apart from one that is healthy but exposes no RP-logout support.
  private readonly failedProviderIds = new Set<number>();

  setConfiguredProviderCount(count: number): void {
    this.configuredProviderCount = count;
  }

  get configuredProviderTotal(): number {
    return this.configuredProviderCount;
  }

  register(oidcId: number, client: BaseClient): void {
    this.clients.set(oidcId, client);
  }

  markFailed(oidcId: number): void {
    this.failedProviderIds.add(oidcId);
  }

  clearFailures(): void {
    this.failedProviderIds.clear();
  }

  getFailedProviderIds(): number[] {
    return [...this.failedProviderIds];
  }

  /**
   * Returns the id of the only registered provider when exactly one was
   * configured. Used as a logout fallback for sessions created before the login
   * provider was tracked on the session.
   */
  getSoleOidcId(): number | undefined {
    // Only infer the provider when exactly one was *configured*. If a second
    // configured provider failed discovery, a legacy session may have logged in
    // with it, so the lone survivor must not be assumed to be the right one.
    if (this.configuredProviderCount === 1 && this.clients.size === 1) {
      return this.clients.keys().next().value;
    }
    return undefined;
  }

  /**
   * Builds the RP-Initiated Logout URL for the provider the user logged in with,
   * based on the end_session_endpoint discovered from the provider's metadata.
   * Returns null when the provider does not expose an end_session_endpoint
   * (e.g. Google), in which case only a local logout is possible.
   */
  getEndSessionUrl(oidcId: number, idToken?: string): string | null {
    const client = this.clients.get(oidcId);
    if (!client) {
      // The provider the session logged in with is not registered (never
      // configured, or failed discovery at startup). This is distinct from a
      // healthy provider that simply exposes no end_session_endpoint, so it is
      // logged rather than treated as expected local-only behavior.
      Logger.warn(`Cannot build end-session URL: OIDC provider ${oidcId} is not registered`);
      return null;
    }
    if (!client.issuer.metadata.end_session_endpoint) {
      return null;
    }
    return client.endSessionUrl({
      id_token_hint: idToken,
      post_logout_redirect_uri: `${config.MY_URL_API_PATH}/auth/post-logout`,
      client_id: client.metadata.client_id,
    });
  }
}
