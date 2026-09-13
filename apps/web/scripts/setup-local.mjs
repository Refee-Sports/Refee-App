#!/usr/bin/env node
/**
 * Points this web app at the local Supabase stack the mobile app uses, so the
 * seeded test accounts ((555) 555-0100 … 0105, OTP 123456) work here too.
 *
 * Reads `supabase status` from the mobile repo and writes .env.local. Run:
 *   npm run setup:local
 *   npm run setup:local -- ../some/other/path/to/refee
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_FILE = resolve(process.cwd(), ".env.local");

/** Where the mobile repo's supabase/ directory usually sits, relative to here. */
const CANDIDATE_DIRS = [
  "../Refee-Mobile/refee",
  "../refee-mobile/refee",
  "../Refee-App/refee",
  "../Refee-Mobile",
];

/**
 * Parses `supabase status -o env` output: KEY="value" lines.
 * Exported for the parser test in this file's sibling spec.
 */
export function parseStatusEnv(text) {
  const out = {};
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

/**
 * Picks the browser-safe key. Never the service-role or secret key — those
 * bypass RLS, and anything in a NEXT_PUBLIC_ var ships to the browser.
 */
export function pickAnonKey(vars) {
  const candidate = vars.PUBLISHABLE_KEY || vars.ANON_KEY;
  if (!candidate) return null;
  if (/^sb_secret_/i.test(candidate) || candidate === vars.SERVICE_ROLE_KEY) {
    return null;
  }
  return candidate;
}

function findMobileDir() {
  const fromArg = process.argv[2];
  const dirs = fromArg ? [fromArg] : CANDIDATE_DIRS;
  for (const d of dirs) {
    const abs = resolve(process.cwd(), d);
    if (existsSync(resolve(abs, "supabase/config.toml"))) return abs;
  }
  return null;
}

function main() {
  const dir = findMobileDir();
  if (!dir) {
    console.error(
      `Couldn't find the mobile repo's supabase/ directory.\n` +
        `Looked in: ${CANDIDATE_DIRS.join(", ")}\n` +
        `Pass the path explicitly:  npm run setup:local -- ../path/to/refee`
    );
    process.exit(1);
  }
  console.log(`Reading Supabase status from ${dir}`);

  let raw;
  try {
    raw = execFileSync("supabase", ["status", "-o", "env"], {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (err) {
    console.error(
      `\n\`supabase status\` failed. Is the stack running?\n` +
        `  cd ${dir} && supabase start\n\n` +
        String(err.stderr || err.message).trim()
    );
    process.exit(1);
  }

  const vars = parseStatusEnv(raw);
  const url = vars.API_URL;
  const key = pickAnonKey(vars);

  if (!url || !key) {
    console.error(
      `Couldn't read a usable API URL and publishable/anon key from \`supabase status\`.\n` +
        `Got keys: ${Object.keys(vars).join(", ") || "(none)"}\n` +
        `Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local by hand.`
    );
    process.exit(1);
  }

  // Preserve anything already in .env.local that we don't manage (Stripe etc).
  const managed = new Set([
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "NEXT_PUBLIC_APP_ENV",
  ]);
  const kept = existsSync(ENV_FILE)
    ? readFileSync(ENV_FILE, "utf8")
        .split("\n")
        .filter((l) => {
          const name = l.match(/^\s*([A-Z0-9_]+)\s*=/)?.[1];
          return l.trim() && !l.trim().startsWith("#") && name && !managed.has(name);
        })
    : [];

  const body = [
    "# Written by `npm run setup:local` — points at the mobile app's local Supabase.",
    "# Test accounts: (555) 555-0100 … 0105, OTP 123456.",
    `NEXT_PUBLIC_SUPABASE_URL=${url}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${key}`,
    "NEXT_PUBLIC_APP_ENV=development",
    ...kept,
    "",
  ].join("\n");

  writeFileSync(ENV_FILE, body);
  console.log(`\nWrote .env.local`);
  console.log(`  NEXT_PUBLIC_SUPABASE_URL=${url}`);
  console.log(`  NEXT_PUBLIC_SUPABASE_ANON_KEY=${key.slice(0, 12)}…`);
  if (kept.length) console.log(`  (kept ${kept.length} other line(s))`);
  console.log(`\nNow run:  npm run dev`);
  console.log(`Then sign in at /auth/sign-in with (555) 555-0100 and OTP 123456.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
