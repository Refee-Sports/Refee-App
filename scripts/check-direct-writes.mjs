#!/usr/bin/env node
/**
 * Keeps business rules in the backend. Every direct table write
 * (`.from("table")….insert/update/upsert/delete(`) in app or shared code must be
 * listed in scripts/direct-writes.allowlist.json with a reason — normally
 * "owner-only edit of a single row, no side effects, no money". Anything else
 * (staffing, payments, multi-row changes) belongs in an RPC or edge function.
 *
 *   node scripts/check-direct-writes.mjs          fail on unlisted writes
 *   node scripts/check-direct-writes.mjs --list   print every write found
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SCAN = [
  "packages/core/src",
  "apps/web/app",
  "apps/web/components",
  "apps/web/hooks",
  "apps/web/lib",
  "apps/mobile/app",
  "apps/mobile/components",
  "apps/mobile/hooks",
  "apps/mobile/lib",
];
const ALLOWLIST = join(ROOT, "scripts/direct-writes.allowlist.json");

function* sourceFiles(dir) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* sourceFiles(path);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) yield path;
  }
}

/** "file::table.op" → occurrences */
function findWrites() {
  const found = new Map();
  for (const base of SCAN) {
    const abs = join(ROOT, base);
    try {
      statSync(abs);
    } catch {
      continue;
    }
    for (const file of sourceFiles(abs)) {
      const src = readFileSync(file, "utf8");
      const from = /\.from\(\s*["'`]([a-z_]+)["'`]\s*\)/g;
      let m;
      while ((m = from.exec(src))) {
        // The call chain runs until the statement ends or the next .from(.
        const rest = src.slice(from.lastIndex);
        const stop = rest.search(/;|\.from\(/);
        const chain = stop === -1 ? rest : rest.slice(0, stop);
        const op = chain.match(/\.(insert|update|upsert|delete)\(/);
        if (!op) continue;
        const key = `${relative(ROOT, file)}::${m[1]}.${op[1]}`;
        found.set(key, (found.get(key) ?? 0) + 1);
      }
    }
  }
  return found;
}

const found = findWrites();

if (process.argv.includes("--list")) {
  for (const [key, n] of [...found].sort()) console.log(`${key}${n > 1 ? `  ×${n}` : ""}`);
  process.exit(0);
}

const allowed = JSON.parse(readFileSync(ALLOWLIST, "utf8"));
const unlisted = [...found.keys()].filter((key) => !(key in allowed)).sort();
const stale = Object.keys(allowed).filter((key) => !found.has(key)).sort();

for (const key of stale) {
  console.warn(`stale allowlist entry (write no longer exists): ${key}`);
}
if (unlisted.length > 0) {
  console.error(
    "Direct table writes that aren't in scripts/direct-writes.allowlist.json:\n" +
      unlisted.map((key) => `  ${key}`).join("\n") +
      "\n\nMove the write into an RPC or edge function. If it really is an owner-only,\n" +
      "single-row edit with no side effects, add it to the allowlist with the reason."
  );
  process.exit(1);
}
console.log(`Direct writes: ${found.size} call sites, all allowlisted.`);
