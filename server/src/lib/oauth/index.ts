import { env } from "../../env.js";
import { createJwksVerifier } from "./jwksProvider.js";
import { createMockVerifier } from "./mockProvider.js";
import type { OAuthVerifier } from "./types.js";

export type { OAuthIdentity, OAuthVerifier } from "./types.js";

const verifiers: Record<"GOOGLE" | "APPLE" | "MICROSOFT", OAuthVerifier> = {
  GOOGLE: env.oauth.googleClientId
    ? createJwksVerifier({
        label: "Google",
        jwksUri: "https://www.googleapis.com/oauth2/v3/certs",
        issuer: "https://accounts.google.com",
        audience: env.oauth.googleClientId,
      })
    : createMockVerifier("Google"),

  APPLE: env.oauth.appleClientId
    ? createJwksVerifier({
        label: "Apple",
        jwksUri: "https://appleid.apple.com/auth/keys",
        issuer: "https://appleid.apple.com",
        audience: env.oauth.appleClientId,
      })
    : createMockVerifier("Apple"),

  // Microsoft/Azure AD v2 issues a per-tenant issuer
  // (https://login.microsoftonline.com/{tenant-guid}/v2.0) even for
  // multi-tenant "common" apps, so the issuer is validated with a pattern
  // rather than an exact string - see jwksProvider.ts.
  MICROSOFT: env.oauth.microsoftClientId
    ? createJwksVerifier({
        label: "Microsoft",
        jwksUri: `https://login.microsoftonline.com/${env.oauth.microsoftTenant}/discovery/v2.0/keys`,
        issuer: /^https:\/\/login\.microsoftonline\.com\/[0-9a-fA-F-]{36}\/v2\.0$/,
        audience: env.oauth.microsoftClientId,
      })
    : createMockVerifier("Microsoft"),
};

export function getOAuthVerifier(provider: "GOOGLE" | "APPLE" | "MICROSOFT"): OAuthVerifier {
  return verifiers[provider];
}

export function listOAuthProviderStatus() {
  return (Object.keys(verifiers) as Array<keyof typeof verifiers>).map((provider) => ({
    provider,
    label: verifiers[provider].label,
    live: verifiers[provider].isLive,
  }));
}
