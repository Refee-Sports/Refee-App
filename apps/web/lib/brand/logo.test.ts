import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LOGO_SRC } from "./logo";

const PUBLIC = join(__dirname, "../../public");
const KIT = join(__dirname, "../../../../brand/logo");

describe("site logo", () => {
  it.each(Object.entries(LOGO_SRC))("%s lockup is served from public/", (_tone, src) => {
    expect(existsSync(join(PUBLIC, src))).toBe(true);
  });

  it.each(Object.entries(LOGO_SRC))("%s lockup matches the brand kit master", (_tone, src) => {
    const name = src.split("/").pop()!;
    expect(readFileSync(join(PUBLIC, src), "utf8")).toBe(readFileSync(join(KIT, name), "utf8"));
  });
});
