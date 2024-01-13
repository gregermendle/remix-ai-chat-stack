import path from "node:path";

import { unstable_vitePlugin as remix } from "@remix-run/dev";
import { installGlobals } from "@remix-run/node";
import { defineConfig } from "vite";

installGlobals();

export default defineConfig({
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./app"),
    },
  },
  plugins: [remix({
    ignoredRouteFiles: ["**/.*", "**/*.test.{ts,tsx}"],
  })],
});