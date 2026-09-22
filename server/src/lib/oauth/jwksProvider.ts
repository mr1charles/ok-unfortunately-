import { createRemoteJWKSet, jwtVerify } from "jose";
import { ApiError } from "../../utils/apiError.js";
import type { OAuthIdentity, OAuthVerifier } from "./types.js";

export interface JwksProviderConfig {
  label: string;
  jwksUri: string;
  audience: string;
  /** Exact issuer string, OR a RegExp for providers whose issuer varies
   * per-tenant (Microsoft: https://login.microsoftonline.com/{tenant}/v2.0). */
  issuer: string | RegExp;
}

/**
 * A real OIDC ID-token verifier: fetches the provider's public signing
 * keys (JWKS), verifies the token's signature, expiry, issuer, and
 * audience, and extracts the standard claims every OIDC provider
 * (Google, Apple, Microsoft) issues. `jose`'s `createRemoteJWKSet` caches
 * and auto-rotates the key set, so this does not re-fetch JWKS on every
 * request.
 */
export function createJwksVerifier(config: JwksProviderConfig): OAuthVerifier {
  const jwks = createRemoteJWKSet(new URL(config.jwksUri));

  return {
    label: config.label,
    isLive: true,
    async verify(idToken: string): Promise<OAuthIdentity> {
      let payload;
      try {
        const result = await jwtVerify(idToken, jwks, {
          audience: config.audience,
          ...(typeof config.issuer === "string" ? { issuer: config.issuer } : {}),
        });
        payload = result.payload;
      } catch (err) {
        throw ApiError.unauthorized(`Could not verify ${config.label} sign-in (${(err as Error).message})`);
      }

      if (config.issuer instanceof RegExp && !config.issuer.test(String(payload.iss ?? ""))) {
        throw ApiError.unauthorized(`Could not verify ${config.label} sign-in (unexpected issuer)`);
      }

      const subject = payload.sub;
      if (!subject) {
        throw ApiError.unauthorized(`${config.label} did not return a subject identifier`);
      }

      return {
        providerAccountId: subject,
        email: typeof payload.email === "string" ? payload.email : null,
        emailVerified: payload.email_verified === true || payload.email_verified === "true",
        name: typeof payload.name === "string" ? payload.name : null,
      };
    },
  };
}
