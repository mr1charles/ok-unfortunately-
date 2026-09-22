import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { CharacterAppearance } from "@pixel-estates/shared";
import { DEFAULT_CHARACTER_APPEARANCE } from "@pixel-estates/shared";
import { CharacterCreator } from "../components/character/CharacterCreator";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import * as authApi from "../api/auth";
import { formatCents } from "../lib/format";
import { AuthShell } from "./LoginPage";

export function OnboardingPage() {
  const { me, setMe } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [saving, setSaving] = useState(false);

  async function handleSaveCharacter(appearance: CharacterAppearance) {
    setSaving(true);
    try {
      await authApi.updateCharacterAppearance(appearance);
      setStep(2);
    } catch {
      toast("Could not save your character, try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function finish() {
    const { user } = await authApi.completeOnboarding();
    setMe(user);
    toast("Welcome to Pixel Estates! 🏝️", "success");
    navigate("/world");
  }

  if (!me) return null;

  if (step === 1) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-brand-600 via-brand-500 to-emerald-400 p-4">
        <div className="panel p-8 w-full max-w-2xl animate-pop-in">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-500 mb-1">Step 1 of 2</p>
          <h1 className="text-2xl font-extrabold mb-1">Create your character</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            This is how you'll appear as you explore the world. You can change this anytime in Settings.
          </p>
          <CharacterCreator
            initial={me.character?.appearance ?? DEFAULT_CHARACTER_APPEARANCE}
            onSave={handleSaveCharacter}
            saving={saving}
          />
        </div>
      </div>
    );
  }

  return (
    <AuthShell>
      <p className="text-xs font-bold uppercase tracking-wide text-brand-500 mb-1">Step 2 of 2</p>
      <h1 className="text-2xl font-extrabold mb-4">How Pixel Estates works</h1>
      <ul className="flex flex-col gap-3 text-sm mb-6">
        <li className="flex gap-3">
          <span className="text-xl">🗺️</span>
          <span>Explore a world made of individually-owned land plots. Green plots are still available.</span>
        </li>
        <li className="flex gap-3">
          <span className="text-xl">💵</span>
          <span>Buy land directly from the platform, or from other players on the marketplace.</span>
        </li>
        <li className="flex gap-3">
          <span className="text-xl">🔨</span>
          <span>Auction your land or bid on other players' plots. The platform takes a 10% fee on player-to-player sales.</span>
        </li>
        <li className="flex gap-3">
          <span className="text-xl">📈</span>
          <span>
            Land prices are set entirely by the marketplace — they can go up <em>or down</em>. Nothing here is a
            guaranteed investment.
          </span>
        </li>
        <li className="flex gap-3">
          <span className="text-xl">🎁</span>
          <span>
            You're starting with <strong>{formatCents(me.balanceCents)}</strong> in test funds (development mode
            only — no real money).
          </span>
        </li>
      </ul>
      <button className="btn-primary w-full" onClick={finish}>
        Enter the world
      </button>
    </AuthShell>
  );
}
