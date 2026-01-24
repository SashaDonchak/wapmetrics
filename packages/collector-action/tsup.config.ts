import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  target: "node20",
  platform: "node",
  // Actions run in node, so we want to bundle dependencies (except node builtins)
  noExternal: [/(.*)/],
  sourcemap: true,
  clean: true,
  dts: false, // Actions don't typically need dts files
  minify: false, // Easier debugging
  shims: true, // Inject shims for __dirname, etc if needed
});
