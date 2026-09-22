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

export function updateCharacterAppearance(appearance: CharacterAppearance) {
  return api.patch<{ character: Character }>("/users/me/character", { appearance });
}

export function updateCharacterPosition(x: number, y: number) {
  return api.patch<{ character: Character }>("/users/me/character/position", { x, y });
}

export function completeOnboarding() {
  return api.post<{ user: Me }>("/users/me/onboarding/complete");
}
