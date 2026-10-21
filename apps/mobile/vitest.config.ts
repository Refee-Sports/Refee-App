import { defineConfig } from "vitest/config";
import path from "node:path";

// This app's own logic (lib/), plus the shared @refee/core suite
// (packages/core/test), which both apps run so shared code is proven under
// each. Shared tests register a fake backend with configureSupabase.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "../../packages/core/test/**/*.test.ts", "../../packages/design/test/**/*.test.ts"],
    globals: false,
  },
});
