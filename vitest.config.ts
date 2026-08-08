const path = require("node:path");
const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    // Component tests opt in with `// @vitest-environment jsdom`.
    setupFiles: ["./tests/setup.ts"],
  },
});
