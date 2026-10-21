import { describe, expect, it } from "vitest";
import { badgeVariants, buttonVariants, kebab } from "@refee/design";
import { buttonClasses } from "@/components/ui/AppButton";
import { badgeClasses } from "@/components/ui/Badge";

// Web keeps literal Tailwind classes (the compiler only ships classes it can
// see), so this checks they name the same tokens as the shared look tables
// in @refee/design that mobile renders from.
const cls = (prefix: string, key: string) =>
  key === "transparent" ? `${prefix}-transparent` : `${prefix}-${kebab(key)}`;
const tokensOf = (classes: string) => classes.split(/\s+/);

describe("AppButton matches @refee/design", () => {
  for (const [variant, look] of Object.entries(buttonVariants)) {
    it(variant, () => {
      const c = tokensOf(buttonClasses[variant as keyof typeof buttonClasses]);
      expect(c).toContain(cls("bg", look.bg));
      expect(c).toContain(cls("text", look.fg));
      expect(c).toContain(cls("border", look.border));
      if (look.bgPressed !== look.bg) expect(c).toContain(cls("active:bg", look.bgPressed));
      if (look.fgPressed !== look.fg) expect(c).toContain(cls("active:text", look.fgPressed));
    });
  }
});

describe("Badge matches @refee/design", () => {
  for (const [variant, look] of Object.entries(badgeVariants)) {
    it(variant, () => {
      const c = tokensOf(badgeClasses[variant as keyof typeof badgeClasses]);
      expect(c).toContain(cls("bg", look.bg));
      expect(c).toContain(cls("text", look.fg));
      expect(c).toContain(cls("border", look.border));
    });
  }
});
