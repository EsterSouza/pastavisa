const path = require("node:path");
const { configDefaults, defineConfig } = require("vitest/config");

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
    // As specs do Playwright terminam em `.spec.ts` e cairiam no include padrão
    // do Vitest, que tentaria rodá-las sem navegador. Elas têm runner próprio:
    // `npm run test:e2e`.
    exclude: [...configDefaults.exclude, "tests/e2e/**"],
    // Component tests opt in with `// @vitest-environment jsdom`.
    setupFiles: ["./tests/setup.ts"],
  },
});
