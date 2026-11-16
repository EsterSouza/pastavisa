/** Regras de caminho puras: usadas no middleware (Edge) e nas rotas. */

const ADMIN_PREFIXES = ["/templates", "/legislacoes", "/api/templates", "/api/legislacoes"];

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_PREFIXES.some((prefix) => matchesPrefix(pathname, prefix));
}

export function isPublicPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    matchesPrefix(pathname, "/api/auth") ||
    pathname === "/api/health" ||
    // O timer da caixa chama sem sessão; a rota confere o CRON_SECRET sozinha.
    matchesPrefix(pathname, "/api/cron") ||
    matchesPrefix(pathname, "/planner") ||
    pathname === "/api/planejamento-comercial/analisar" ||
    pathname === "/api/planejamento-comercial/pdf"
  );
}
