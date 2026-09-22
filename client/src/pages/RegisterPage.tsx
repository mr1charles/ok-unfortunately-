import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { ApiClientError } from "../api/client";
import { AuthShell } from "./LoginPage";
import { SocialSignInButtons } from "../components/auth/SocialSignInButtons";
import type { Me } from "../types";

export function RegisterPage() {
  const { register, setMe } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await register(email, username, password);
      toast("Account created! Let's customize your character.", "success");
      navigate("/onboarding");
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Registration failed", "error");
    } finally {
      setBusy(false);
    }
  }

  function handleSocialSuccess(user: Me, isNewAccount: boolean) {
    setMe(user);
    toast(isNewAccount ? `Welcome to Pixel Estates, ${user.username}!` : `Welcome back, ${user.username}!`, "success");
    navigate(user.hasOnboarded ? "/world" : "/onboarding");
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-extrabold mb-1">Create your account</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
        In development mode you'll start with $100.00 in test funds — no real money involved.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label className="label">Username</label>
          <input
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            minLength={3}
            maxLength={20}
            pattern="[a-zA-Z0-9_]+"
            title="Letters, numbers, and underscores only"
            required
          />
        </div>
        <div>
          <label className="label">Password</label>
          <input
            type="password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
            required
          />
        </div>
        <button className="btn-primary w-full mt-2" disabled={busy}>
          {busy ? "Creating account..." : "Create account"}
        </button>
      </form>

      <div className="mt-4">
        <SocialSignInButtons onSuccess={handleSocialSuccess} />
      </div>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Already have an account?{" "}
        <Link to="/login" className="text-brand-500 font-bold hover:underline">
          Log in
        </Link>
      </p>
    </AuthShell>
  );
}
