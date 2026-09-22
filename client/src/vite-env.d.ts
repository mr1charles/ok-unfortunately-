/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional real OAuth client IDs. Unset by default in this prototype -
   * see SocialSignInButtons.tsx, which falls back to a dev sign-in dialog
   * for any provider whose client ID isn't configured here (matching what
   * the server reports at GET /api/auth/oauth/providers). */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
  readonly VITE_APPLE_CLIENT_ID?: string;
  readonly VITE_MICROSOFT_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
