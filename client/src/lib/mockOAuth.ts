/**
 * Builds a dev-mode "mock" identity token in the exact format
 * server/src/lib/oauth/mockProvider.ts expects (`mock.<base64url JSON>`).
 * Only ever used when GET /api/auth/oauth/providers reports a provider as
 * not "live" (i.e. no real client ID configured server-side) - see
 * SocialSignInButtons.tsx. This lets the whole sign-in/account-linking flow
 * be exercised without a real Google/Apple/Microsoft developer account,
 * the same way the mock payment provider lets checkout be tested without a
 * real payment processor.
 */
export function buildMockIdToken(params: { sub: string; email: string; name: string }): string {
  const json = JSON.stringify(params);
  const base64 = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `mock.${base64}`;
}
