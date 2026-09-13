const path = require("path");
const fs = require("fs");

const appJson = require("./app.json");

function loadEnvFile(relativePath) {
  const fullPath = path.join(__dirname, relativePath);
  if (!fs.existsSync(fullPath)) return {};
  return require("dotenv").parse(fs.readFileSync(fullPath));
}

// `REFEE_ENV_FILE` is set by `npm run start:local` so local Supabase wins over `.env` / `.env.dev`.
const localEnv = process.env.REFEE_ENV_FILE;
let supabaseUrl;
let supabaseAnonKey;
let stripePublishableKey;

if (localEnv) {
  const parsed = loadEnvFile(localEnv);
  supabaseUrl = parsed.EXPO_PUBLIC_SUPABASE_URL;
  supabaseAnonKey = parsed.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  stripePublishableKey = parsed.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  console.log(`[refee] Local env from ${localEnv}`);
  console.log(`[refee] EXPO_PUBLIC_SUPABASE_URL=${supabaseUrl}`);
} else {
  const base = loadEnvFile(".env");
  const appEnv = process.env.EXPO_PUBLIC_APP_ENV ?? "development";
  const envFile = appEnv === "production" ? ".env.prod" : appEnv === "staging" ? ".env.stg" : ".env.dev";
  const selected = process.env.EXPO_NO_DOTENV === "1" ? {} : loadEnvFile(envFile);

  // CI/EAS/project environment always wins. Checked-in/local files are only a
  // developer fallback and can never silently replace production values.
  supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? selected.EXPO_PUBLIC_SUPABASE_URL ?? base.EXPO_PUBLIC_SUPABASE_URL;
  supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? selected.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? base.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  stripePublishableKey =
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? selected.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? base.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
}

module.exports = {
  ...appJson,
  expo: {
    ...appJson.expo,
    extra: {
      ...appJson.expo?.extra,
      supabaseUrl,
      supabaseAnonKey,
      stripePublishableKey,
    },
    ios: {
      ...appJson.expo.ios,
      infoPlist: {
        NSAppTransportSecurity: {
          NSAllowsLocalNetworking: true,
        },
      },
    },
  },
};
