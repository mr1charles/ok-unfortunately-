import { ApiError } from "../../utils/apiError.js";
import type { OAuthIdentity, OAuthVerifier } from "./types.js";

/**
 * Development/prototype verifier, used automatically for any provider that
 * doesn't have a real client ID configured (see index.ts). Mirrors
 * MockPaymentProvider: lets the entire sign-in flow - account linking,
 * find-or-create, session issuance - be exercised end-to-end without a
 * real Google/Apple/Microsoft developer account, exactly the way
 * MockPaymentProvider lets checkout be tested without a real payment
 * processor.
 *
 * Never verifies a real signature. Only accepts tokens shaped like
 * `mock.<base64url JSON>` (see client/src/lib/mockOAuth.ts and
 * game-client's dev sign-in dialog for producers of this format) so it can
 * never be confused with - or accidentally accept - a real provider's JWT.
 */
export function createMockVerifier(label: string): OAuthVerifier {
  return {
    label,
    isLive: false,
    async verify(idToken: string): Promise<OAuthIdentity> {
      if (!idToken.startsWith("mock.")) {
        throw ApiError.badRequest(
          `${label} sign-in is running in development mode (no real client ID configured) and only accepts mock tokens`
        );
      }
      let payload: Record<string, unknown>;
      try {
        const json = Buffer.from(idToken.slice("mock.".length), "base64url").toString("utf8");
        payload = JSON.parse(json);
      } catch {
        throw ApiError.badRequest("Malformed mock sign-in token");
      }

      const sub = payload.sub;
      if (typeof sub !== "string" || sub.length === 0) {
        throw ApiError.badRequest("Mock sign-in token is missing a subject id");
      }

      return {
        providerAccountId: sub,
        email: typeof payload.email === "string" ? payload.email : null,
        emailVerified: true,
        name: typeof payload.name === "string" ? payload.name : null,
      };
    },
  };
}
