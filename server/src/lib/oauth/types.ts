/**
 * Social sign-in abstraction, same spirit as lib/payments/PaymentProvider.ts:
 * the rest of the app (oauthService, routes/auth.ts) never talks to Google/
 * Apple/Microsoft directly, only to this interface. This is exactly the
 * architecture a native iOS/Android app uses too - the platform's Google
 * Sign-In SDK / Sign in with Apple / MSAL SDK produces a signed ID token on
 * the device, and the ONLY thing the backend needs to do is verify it and
 * map it to a local account. The verification code here is real (JWKS
 * signature + issuer + audience checks via `jose`), so it works as-is once
 * real client IDs are configured - see server/.env.example.
 */

export interface OAuthIdentity {
  providerAccountId: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
}

export interface OAuthVerifier {
  /** Human-readable name for logs/errors, e.g. "Google". */
  readonly label: string;
  /** True when this verifier is checking real signatures against the
   * provider's live JWKS (false for the mock/dev verifier). */
  readonly isLive: boolean;
  verify(idToken: string): Promise<OAuthIdentity>;
}
