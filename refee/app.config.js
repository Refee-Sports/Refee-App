const path = require("path");
const fs = require("fs");

const appJson = require("./app.json");

function loadEnvFile(relativePath) {
  const fullPath = path.join(__dirname, relativePath);
  if (!fs.existsSync(fullPath)) return {};
  const result = require("dotenv").config({ path: fullPath, override: true });
  return result.parsed ?? {};
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
  loadEnvFile(".env");
  const dev = loadEnvFile(".env.dev");
  supabaseUrl = dev.EXPO_PUBLIC_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  supabaseAnonKey = dev.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  stripePublishableKey =
    dev.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;
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
