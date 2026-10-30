import path from "node:path"
import { defineConfig } from "vite"

/**
 * Vite / Vitest configuration.
 *
 * The repo had no Vite config, which meant the `@/` path alias declared in
 * tsconfig.json did not resolve inside tests — any test that imported a
 * module using the alias failed to even load. This config wires the alias up
 * so tests can import application modules directly.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules/**", ".next/**"],
  },
})
