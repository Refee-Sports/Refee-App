#!/usr/bin/env node
/**
 * Fails if a real secret is about to be committed, or if a server-only secret
 * has found its way into something the apps ship.
 *
 * Two separate mistakes, both easy to make and both invisible once made:
 *
 *   1. A key pasted into a tracked file. Chat, a scratch note, an .env that
 *      lost its ignore rule — it ends up in history, and history is forever
 *      even after the file is deleted.
 *   2. A server-only value read from client code. Anything a screen or a
 *      shared package imports is downloaded by every visitor, so a
 *      service-role key or a Stripe secret there is public the moment it
 *      ships.
 *
 * Deliberately pattern-based and narrow: it looks for the shapes of the keys
 * this project actually uses, so it stays quiet rather than crying wolf.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SECRET_SHAPES = [
  { name: "Stripe secret key", re: /\bsk_(live|test)_[A-Za-z0-9]{20,}/ },
  { name: "Stripe webhook signing secret", re: /\bwhsec_[A-Za-z0-9]{20,}/ },
  { name: "Anthropic API key", re: /\bsk-ant-[A-Za-z0-9-]{20,}/ },
  // A Supabase service-role JWT: role claim baked into the payload.
  { name: "Supabase service-role key", re: /\bey[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*c2VydmljZV9yb2xl/ },
  { name: "Supabase secret key", re: /\bsb_secret_[A-Za-z0-9_-]{20,}/ },
  { name: "private key block", re: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/ },
];

// Server-only names that must never be read from code the apps ship.
const SERVER_ONLY = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "ANTHROPIC_API_KEY",
  "DIDIT_API_KEY",
  "DIDIT_WEBHOOK_SECRET",
];

const CLIENT_DIRS = ["apps/web/app", "apps/web/components", "apps/web/lib", "apps/mobile/app", "apps/mobile/lib", "packages/core/src"];

const tracked = execFileSync("git", ["ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean);
const problems = [];

for (const file of tracked) {
  // Examples are meant to show the shape of a key, and this script names the
  // shapes it looks for, so both would match themselves.
  if (/\.example$/.test(file) || file === "scripts/check-secrets.mjs") continue;
  if (/^(apps\/mobile\/docs|docs)\/.*\.md$/.test(file)) continue;

  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue; // binary or unreadable
  }

  for (const { name, re } of SECRET_SHAPES) {
    const m = text.match(re);
    if (m) problems.push(`${file}: looks like a ${name} (${m[0].slice(0, 12)}…)`);
  }

  if (CLIENT_DIRS.some((d) => file.startsWith(d))) {
    for (const key of SERVER_ONLY) {
      if (text.includes(key)) {
        problems.push(`${file}: reads ${key}, which the apps ship to every visitor`);
      }
    }
  }
}

if (problems.length) {
  console.error("Secret check failed:\n");
  for (const p of problems) console.error(`  ${p}`);
  console.error(
    "\nIf one of these is real: rotate it first, then remove it. Deleting the\n" +
      "line is not enough once it has been committed — the value stays in history.\n"
  );
  process.exit(1);
}

console.log(`Secret check passed (${tracked.length} tracked files).`);
