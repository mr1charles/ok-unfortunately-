import "dotenv/config";

function required(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return v;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  isProduction: process.env.NODE_ENV === "production",
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET", "dev-only-secret-change-me"),
  clientOrigin: (process.env.CLIENT_ORIGIN ?? "http://localhost:5173")
    .split(",")
    .map((s) => s.trim()),

  // Social sign-in. Leaving a client ID unset makes that provider fall
  // back to the mock verifier automatically (see lib/oauth/index.ts) -
  // there is no separate "enable OAuth" flag, presence of the client ID
  // is the switch.
  oauth: {
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
    appleClientId: process.env.APPLE_CLIENT_ID ?? "",
    microsoftClientId: process.env.MICROSOFT_CLIENT_ID ?? "",
    microsoftTenant: process.env.MICROSOFT_TENANT ?? "common",
  },
};
