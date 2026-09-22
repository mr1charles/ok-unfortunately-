import { useState } from "react";
import { Link } from "react-router-dom";
import * as walletApi from "../api/wallet";
import * as authApi from "../api/auth";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { ApiClientError } from "../api/client";
import { formatCents, dollarsToCents } from "../lib/format";
import { CharacterCreator } from "../components/character/CharacterCreator";
import type { CharacterAppearance } from "@pixel-estates/shared";
import { DEFAULT_CHARACTER_APPEARANCE } from "@pixel-estates/shared";

const TOPUP_PRESETS = [500, 1000, 2500, 10000];

export function SettingsPage() {
  const { me, refresh } = useAuth();
  const { theme, toggle } = useTheme();
  const { toast } = useToast();
  const [depositing, setDepositing] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("10.00");
  const [withdrawing, setWithdrawing] = useState(false);
  const [savingCharacter, setSavingCharacter] = useState(false);

  async function deposit(amountCents: number) {
    setDepositing(true);
    try {
      await walletApi.depositMockFunds(amountCents);
      await refresh();
      toast(`Added ${formatCents(amountCents)} in test funds.`, "success");
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Deposit failed", "error");
    } finally {
      setDepositing(false);
    }
  }

  async function withdraw() {
    setWithdrawing(true);
    try {
      await walletApi.withdrawFunds(dollarsToCents(withdrawAmount));
      await refresh();
      toast("Withdrawal processed (mock).", "success");
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Withdrawal failed", "error");
    } finally {
      setWithdrawing(false);
    }
  }

  async function saveCharacter(appearance: CharacterAppearance) {
    setSavingCharacter(true);
    try {
      await authApi.updateCharacterAppearance(appearance);
      await refresh();
      toast("Character updated!", "success");
    } catch {
      toast("Could not update character", "error");
    } finally {
      setSavingCharacter(false);
    }
  }

  if (!me) return null;

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h2 className="text-xl font-extrabold">Settings</h2>
        <p className="text-xs text-slate-400">Manage your wallet, character, and preferences.</p>
      </div>

      <section className="panel p-5">
        <h3 className="font-bold mb-1">Account</h3>
        <div className="grid sm:grid-cols-2 gap-3 text-sm mt-3">
          <div>
            <p className="label !mb-0">Username</p>
            <p className="font-bold">{me.username}</p>
          </div>
          <div>
            <p className="label !mb-0">Email</p>
            <p className="font-bold">{me.email}</p>
          </div>
        </div>
      </section>

      <section className="panel p-5">
        <h3 className="font-bold mb-1">Appearance</h3>
        <p className="text-xs text-slate-400 mb-3">Toggle between light and dark mode.</p>
        <button className="btn-secondary" onClick={toggle}>
          Switch to {theme === "dark" ? "light" : "dark"} mode
        </button>
      </section>

      <section className="panel p-5">
        <h3 className="font-bold mb-1">Wallet</h3>
        <p className="text-xs text-slate-400 mb-3">
          Current balance: <strong>{formatCents(me.balanceCents)}</strong>. This is a development prototype using a
          mock payment system — no real money is involved. In production this would be replaced with a real payment
          provider (e.g. Stripe) without changing how the rest of the game works.
        </p>
        <div className="flex flex-wrap gap-2 mb-4">
          {TOPUP_PRESETS.map((cents) => (
            <button key={cents} className="btn-primary !text-xs" onClick={() => deposit(cents)} disabled={depositing}>
              + {formatCents(cents)}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <div>
            <label className="label">Withdraw ($)</label>
            <input
              type="number"
              min="1"
              step="0.01"
              className="input !w-32"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
            />
          </div>
          <button className="btn-secondary" onClick={withdraw} disabled={withdrawing}>
            {withdrawing ? "Processing..." : "Withdraw"}
          </button>
        </div>
      </section>

      <section className="panel p-5">
        <h3 className="font-bold mb-3">Character</h3>
        <CharacterCreator
          initial={me.character?.appearance ?? DEFAULT_CHARACTER_APPEARANCE}
          onSave={saveCharacter}
          saving={savingCharacter}
        />
      </section>

      <section className="panel p-5 text-xs text-slate-400 leading-relaxed">
        <h3 className="font-bold mb-2 text-slate-600 dark:text-slate-300 text-sm">About land values</h3>
        <p>
          Land prices on Pixel Estates are set entirely by players buying, selling, and bidding on the open
          marketplace. Prices can go up or down, and past sales are not a guarantee of future value. Pixel Estates
          does not promise, imply, or guarantee any return on land you purchase.
        </p>
      </section>

      <section className="panel p-5 text-xs text-slate-400 flex gap-4">
        <Link to="/terms" className="text-brand-500 font-bold hover:underline">
          Terms &amp; Conditions
        </Link>
        <Link to="/privacy" className="text-brand-500 font-bold hover:underline">
          Privacy Policy
        </Link>
      </section>
    </div>
  );
}
