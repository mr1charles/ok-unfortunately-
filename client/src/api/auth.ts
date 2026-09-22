import { api } from "./client";
import type { Character, Me } from "../types";
import type { CharacterAppearance } from "@pixel-estates/shared";

export function register(data: { email: string; username: string; password: string }) {
  return api.post<{ token: string; user: Me }>("/auth/register", data);
}

export function login(data: { emailOrUsername: string; password: string }) {
  return api.post<{ token: string; user: Me }>("/auth/login", data);
}

export function fetchMe() {
  return api.get<{ user: Me }>("/auth/me");
}

export type OAuthProviderKey = "GOOGLE" | "APPLE" | "MICROSOFT";

export function fetchOAuthProviders() {
  return api.get<{ providers: { provider: OAuthProviderKey; label: string; live: boolean }[] }>(
    "/auth/oauth/providers"
  );
}

export function oauthSignIn(provider: OAuthProviderKey, idToken: string) {
  return api.post<{ token: string; user: Me; isNewAccount: boolean }>(`/auth/oauth/${provider.toLowerCase()}`, {
    idToken,
  });
}

export function updateCharacterAppearance(appearance: CharacterAppearance) {
  return api.patch<{ character: Character }>("/users/me/character", { appearance });
}

export function updateCharacterPosition(x: number, y: number) {
  return api.patch<{ character: Character }>("/users/me/character/position", { x, y });
}

export function completeOnboarding() {
  return api.post<{ user: Me }>("/users/me/onboarding/complete");
}
