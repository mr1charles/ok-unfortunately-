import type { OAuthProviderKind } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { ApiError } from "../utils/apiError.js";
import { signAuthToken } from "../lib/jwt.js";
import { getOAuthVerifier, listOAuthProviderStatus } from "../lib/oauth/index.js";
import { provisionNewAccount } from "./authService.js";

export { listOAuthProviderStatus };

async function generateUniqueUsername(base: string): Promise<string> {
  const cleaned = base
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 15);
  const root = cleaned.length >= 3 ? cleaned : "player";

  let candidate = root;
  let suffix = 0;
  // Bounded loop: extremely unlikely to need more than a handful of tries.
  while (await prisma.user.findUnique({ where: { username: candidate } })) {
    suffix += 1;
    candidate = `${root}${suffix}`.slice(0, 20);
    if (suffix > 9999) {
      candidate = `${root}${Date.now().toString(36)}`.slice(0, 20);
      break;
    }
  }
  return candidate;
}

export interface OAuthSignInResult {
  user: Awaited<ReturnType<typeof prisma.user.findUniqueOrThrow>>;
  token: string;
  isNewAccount: boolean;
}

/**
 * Verifies a provider ID token (see lib/oauth) and either logs the player
 * into an already-linked account, links this provider to an existing local
 * account with a matching *verified* email, or provisions a brand-new
 * account - exactly the flow a native "Sign in with Google/Apple/
 * Microsoft" button drives on iOS/Android/web, since all three hand the
 * client a signed ID token and expect the backend to do exactly this.
 */
export async function signInWithOAuth(provider: OAuthProviderKind, idToken: string): Promise<OAuthSignInResult> {
  const verifier = getOAuthVerifier(provider);
  const identity = await verifier.verify(idToken);

  const existingLink = await prisma.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId: identity.providerAccountId } },
    include: { user: true },
  });

  if (existingLink) {
    if (existingLink.user.isBanned) throw ApiError.forbidden("This account has been suspended");
    const token = signAuthToken({ userId: existingLink.user.id, role: existingLink.user.role });
    return { user: existingLink.user, token, isNewAccount: false };
  }

  let user = null as Awaited<ReturnType<typeof prisma.user.findUnique>>;
  if (identity.email && identity.emailVerified) {
    user = await prisma.user.findUnique({ where: { email: identity.email.toLowerCase() } });
  }

  let isNewAccount = false;

  if (user) {
    if (user.isBanned) throw ApiError.forbidden("This account has been suspended");
    await prisma.oAuthAccount.create({
      data: { userId: user.id, provider, providerAccountId: identity.providerAccountId, email: identity.email },
    });
  } else {
    isNewAccount = true;
    const email =
      identity.email?.toLowerCase() ??
      `${provider.toLowerCase()}-${identity.providerAccountId}@users.pixelestates.local`;
    const usernameBase = identity.name ?? identity.email?.split("@")[0] ?? `${provider.toLowerCase()}player`;
    const username = await generateUniqueUsername(usernameBase);

    user = await prisma.$transaction(async (tx) => {
      const created = await provisionNewAccount(tx, { email, username, passwordHash: null });
      await tx.oAuthAccount.create({
        data: { userId: created.id, provider, providerAccountId: identity.providerAccountId, email: identity.email },
      });
      return created;
    });
  }

  const token = signAuthToken({ userId: user.id, role: user.role });
  return { user, token, isNewAccount };
}
