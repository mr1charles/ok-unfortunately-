import { useEffect, useState } from "react";
import * as authApi from "../../api/auth";
import type { OAuthProviderKey } from "../../api/auth";
import type { Me } from "../../types";
import { setToken } from "../../api/client";
import { useToast } from "../../context/ToastContext";
import { ApiClientError } from "../../api/client";
import { buildMockIdToken } from "../../lib/mockOAuth";

/**
 * "Continue with Google / Apple / Microsoft". Each provider is either
 * "live" (a real client ID is configured server-side, per GET
 * /auth/oauth/providers) or running in dev/mock mode - this component
 * checks that once on mount and adapts:
 *
 *  - Live: loads that provider's real SDK (Google Identity Services /
 *    Sign in with Apple JS / MSAL.js) from its official CDN, using the
 *    client ID from the matching VITE_* env var, and asks it for a signed
 *    ID token exactly the way a native iOS/Android app would.
 *  - Mock: opens a small "dev sign-in" dialog so the whole account-
 *    linking flow can be exercised without a real developer account,
 *    clearly labeled as such.
 *
 * In both cases the resulting ID token is sent to the same
 * POST /api/auth/oauth/:provider the mobile clients use - there is no
 * separate "web-only" login path.
 */

const PROVIDER_META: Record<OAuthProviderKey, { label: string; emoji: string }> = {
  GOOGLE: { label: "Google", emoji: "🔵" },
  APPLE: { label: "Apple", emoji: "" },
  MICROSOFT: { label: "Microsoft", emoji: "🪩" },
};

const CLIENT_ID_ENV: Record<OAuthProviderKey, string | undefined> = {
  GOOGLE: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  APPLE: import.meta.env.VITE_APPLE_CLIENT_ID,
  MICROSOFT: import.meta.env.VITE_MICROSOFT_CLIENT_ID,
};

export function SocialSignInButtons({ onSuccess }: { onSuccess: (user: Me, isNewAccount: boolean) => void }) {
  const { toast } = useToast();
  const [providers, setProviders] = useState<{ provider: OAuthProviderKey; label: string; live: boolean }[]>([]);
  const [busyProvider, setBusyProvider] = useState<OAuthProviderKey | null>(null);
  const [devDialog, setDevDialog] = useState<OAuthProviderKey | null>(null);
  const [devName, setDevName] = useState("");
  const [devEmail, setDevEmail] = useState("");

  useEffect(() => {
    authApi
      .fetchOAuthProviders()
      .then((res) => setProviders(res.providers))
      .catch(() => setProviders([]));
  }, []);

  async function completeSignIn(provider: OAuthProviderKey, idToken: string) {
    setBusyProvider(provider);
    try {
      const result = await authApi.oauthSignIn(provider, idToken);
      setToken(result.token);
      onSuccess(result.user, result.isNewAccount);
    } catch (err) {
      toast(err instanceof ApiClientError ? err.message : `${PROVIDER_META[provider].label} sign-in failed`, "error");
    } finally {
      setBusyProvider(null);
    }
  }

  async function handleClick(provider: OAuthProviderKey, isLive: boolean) {
    if (!isLive) {
      setDevName("");
      setDevEmail("");
      setDevDialog(provider);
      return;
    }
    try {
      const idToken = await signInWithRealProvider(provider);
      if (idToken) await completeSignIn(provider, idToken);
    } catch (err) {
      toast(err instanceof Error ? err.message : `${PROVIDER_META[provider].label} sign-in was cancelled`, "error");
    }
  }

  async function submitDevDialog() {
    if (!devDialog) return;
    if (!devEmail.trim()) {
      toast("Enter an email for the dev sign-in", "error");
      return;
    }
    const idToken = buildMockIdToken({
      sub: `dev-${devDialog.toLowerCase()}-${devEmail.trim().toLowerCase()}`,
      email: devEmail.trim().toLowerCase(),
      name: devName.trim() || devEmail.split("@")[0],
    });
    const provider = devDialog;
    setDevDialog(null);
    await completeSignIn(provider, idToken);
  }

  if (providers.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 my-1">
        <div className="h-px bg-slate-200 dark:bg-white/10 flex-1" />
        <span className="text-[11px] text-slate-400 font-bold uppercase">or continue with</span>
        <div className="h-px bg-slate-200 dark:bg-white/10 flex-1" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {providers.map((p) => (
          <button
            key={p.provider}
            type="button"
            className="btn-secondary !text-xs flex-col !py-2.5 gap-0.5"
            disabled={busyProvider !== null}
            onClick={() => handleClick(p.provider, p.live)}
            title={p.live ? `Continue with ${p.label}` : `Continue with ${p.label} (dev mode)`}
          >
            <span className="text-base leading-none">{PROVIDER_META[p.provider].emoji}</span>
            <span>{p.label}</span>
            {!p.live && <span className="text-[9px] text-amber-500 font-bold">DEV</span>}
          </button>
        ))}
      </div>

      {devDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4" onClick={() => setDevDialog(null)}>
          <div className="panel w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-extrabold mb-1">
              {PROVIDER_META[devDialog].emoji} Dev sign-in: {PROVIDER_META[devDialog].label}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              No real {PROVIDER_META[devDialog].label} client ID is configured, so this simulates what a real
              sign-in would hand back (an email + name) without contacting {PROVIDER_META[devDialog].label}. Set{" "}
              <code>{`VITE_${devDialog}_CLIENT_ID`}</code> to enable the real flow.
            </p>
            <div className="flex flex-col gap-3">
              <div>
                <label className="label">Name</label>
                <input className="input" value={devName} onChange={(e) => setDevName(e.target.value)} placeholder="Jordan Lee" />
              </div>
              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  className="input"
                  value={devEmail}
                  onChange={(e) => setDevEmail(e.target.value)}
                  placeholder="jordan@example.com"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button className="btn-secondary" onClick={() => setDevDialog(null)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={submitDevDialog}>
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- Real provider SDK loaders --------------------------------------------
// These only run when a client ID is configured (never in this prototype's
// default dev setup) - see server/.env.example and the VITE_* variables
// referenced above for how to turn each one on.

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load sign-in script"));
    document.head.appendChild(script);
  });
}

async function signInWithRealProvider(provider: OAuthProviderKey): Promise<string | null> {
  const clientId = CLIENT_ID_ENV[provider];
  if (!clientId) throw new Error(`${PROVIDER_META[provider].label} client ID is not configured`);

  if (provider === "GOOGLE") {
    await loadScript("https://accounts.google.com/gsi/client");
    return new Promise((resolve, reject) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const google = (window as any).google;
      if (!google?.accounts?.id) {
        reject(new Error("Google Identity Services failed to load"));
        return;
      }
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (response: { credential: string }) => resolve(response.credential),
      });
      google.accounts.id.prompt((notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          reject(new Error("Google sign-in was dismissed"));
        }
      });
    });
  }

  if (provider === "MICROSOFT") {
    await loadScript("https://alcdn.msauth.net/browser/2.38.3/js/msal-browser.min.js");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msal = (window as any).msal;
    const app = new msal.PublicClientApplication({ auth: { clientId, redirectUri: window.location.origin } });
    await app.initialize();
    const result = await app.loginPopup({ scopes: ["openid", "profile", "email"] });
    return result.idToken as string;
  }

  if (provider === "APPLE") {
    await loadScript("https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AppleID = (window as any).AppleID;
    AppleID.auth.init({
      clientId,
      scope: "name email",
      redirectURI: window.location.origin,
      usePopup: true,
    });
    const result = await AppleID.auth.signIn();
    return result.authorization.id_token as string;
  }

  return null;
}
