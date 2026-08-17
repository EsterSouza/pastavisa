const path = require("node:path");
const { defineConfig } = require("vitest/config");

module.exports = defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  // O tsconfig usa `jsx: "preserve"`, porque é o Next que compila a aplicação. O
  // Vitest não tem esse passo, então sem isto qualquer teste que renderize um
  // componente falha no parse do próprio componente. Não afeta os testes de
  // módulo, que não têm JSX.
  oxc: { jsx: { runtime: "automatic" } },
  test: {
    environment: "node",
    // Component tests opt in with `// @vitest-environment jsdom`.
    setupFiles: ["./tests/setup.ts"],
  },
});
