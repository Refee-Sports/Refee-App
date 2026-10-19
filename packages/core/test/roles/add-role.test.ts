import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { configureSupabase } from "@refee/core/client";

const upsert = vi.hoisted(() => vi.fn(async () => ({ error: null })));
configureSupabase({ from: () => ({ upsert }) } as never);

import { addRole } from "@refee/core/roles/queries";

describe("addRole", () => {
  it("leaves a role the account already has alone instead of rewriting it", async () => {
    // user_roles has no UPDATE policy (by design), so an insert that turns into
    // an update on conflict is refused by RLS. ON CONFLICT DO NOTHING isn't.
    await addRole("u1", "referee");
    expect(upsert).toHaveBeenCalledWith(
      { user_id: "u1", role: "referee" },
      { onConflict: "user_id,role", ignoreDuplicates: true }
    );
  });
});

describe("every write to user_roles", () => {
  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? sources(path) : path.endsWith(".ts") ? [path] : [];
    });
  }

  it("ignores duplicates, since the table can't be updated", () => {
    const offenders: string[] = [];
    for (const file of sources(join(__dirname, "../../src"))) {
      const text = readFileSync(file, "utf8");
      const re = /\.from\("user_roles"\)\s*\.upsert\([^;]*?\)\s*;?/gs;
      for (const match of text.matchAll(re)) {
        if (!match[0].includes("ignoreDuplicates: true")) offenders.push(`${file}: ${match[0].slice(0, 80)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
