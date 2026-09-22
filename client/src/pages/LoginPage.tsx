import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { ApiClientError } from "../api/client";

export function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const user = await login(emailOrUsername, password);
      toast(`Welcome back, ${user.username}!`, "success");
      navigate(user.hasOnboarded ? "/world" : "/onboarding");
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : "Login failed", "error");
    } finally {
      setBusy(false);
    }
  }

  const DEMO_CREDENTIALS: Record<string, { email: string; password: string }> = {
    alice: { email: "alice@example.com", password: "password123" },
    bob: { email: "bob@example.com", password: "password123" },
    carol: { email: "carol@example.com", password: "password123" },
    admin: { email: "admin@pixelestates.dev", password: "admin123" },
  };

  function fillDemo(user: string) {
    const creds = DEMO_CREDENTIALS[user];
    if (!creds) return;
    setEmailOrUsername(creds.email);
    setPassword(creds.password);
  }

  return (
    <AuthShell>
      <h1 className="text-2xl font-extrabold mb-1">Welcome back</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">Log in to explore your world.</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="label">Email or username</label>
          <input
            className="input"
            value={emailOrUsername}
            onChange={(e) => setEmailOrUsername(e.target.value)}
            placeholder="alice@example.com"
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
            placeholder="••••••••"
            required
          />
        </div>
        <button className="btn-primary w-full mt-2" disabled={busy}>
          {busy ? "Logging in..." : "Log in"}
        </button>
      </form>

      <div className="mt-4 text-center text-xs text-slate-400">
        <p className="mb-2 font-bold">Demo accounts (dev mode)</p>
        <div className="flex justify-center gap-2 flex-wrap">
          {["alice", "bob", "carol", "admin"].map((u) => (
            <button key={u} onClick={() => fillDemo(u)} className="btn-secondary !px-2.5 !py-1 !text-xs">
              {u}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        New here?{" "}
        <Link to="/register" className="text-brand-500 font-bold hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-brand-600 via-brand-500 to-emerald-400 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <span className="text-5xl">🏝️</span>
          <h2 className="text-white font-display font-extrabold text-3xl mt-2 drop-shadow-sm">Pixel Estates</h2>
          <p className="text-white/80 text-sm">A virtual world land marketplace</p>
        </div>
        <div className="panel p-8 animate-pop-in">{children}</div>
        <p className="text-center text-xs text-white/70 mt-4">
          <Link to="/terms" className="hover:underline">Terms &amp; Conditions</Link>
          {" · "}
          <Link to="/privacy" className="hover:underline">Privacy Policy</Link>
        </p>
      </div>
    </div>
  );
}
