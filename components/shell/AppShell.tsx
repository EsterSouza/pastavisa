"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

const navigation = [
  { href: "/", label: "Pastas", matches: (path: string) => path === "/" || path.startsWith("/pasta/") },
  { href: "/templates", label: "Templates", matches: (path: string) => path.startsWith("/templates") },
  { href: "/legislacoes", label: "Legislações", matches: (path: string) => path.startsWith("/legislacoes") },
];

function NavigationLinks({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Navegação principal" className={compact ? "grid gap-1" : "grid gap-1"}>
      {navigation.map((item) => {
        const active = item.matches(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center rounded-md px-3 text-sm font-semibold ${
              active
                ? "bg-brand-action text-brand-on-dark"
                : "text-shell-muted hover:bg-shell-hover hover:text-shell-text"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-page lg:grid lg:grid-cols-[17.5rem_minmax(0,1fr)]">
      <aside className="hidden min-h-screen flex-col border-r border-shell-border bg-shell-bg px-5 py-6 lg:flex">
        <Link href="/" aria-label="TreinaVISA, Pastas Sanitárias" className="mb-10 block rounded-md">
          <BrandLogo priority />
          <span className="mt-4 block font-display text-base text-shell-text">Pasta Sanitária</span>
          <span className="mt-1 block text-sm text-shell-muted">Documentação aplicada</span>
        </Link>
        <NavigationLinks />
        <ThemeToggle className="mt-auto w-full justify-center" />
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-popover border-b border-shell-border bg-shell-bg px-4 py-3 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" aria-label="TreinaVISA, Pastas Sanitárias" className="rounded-md">
              <BrandLogo priority className="w-36" />
            </Link>
            <div className="flex items-center gap-2">
              <ThemeToggle className="px-2 [&>span]:hidden" />
              <details className="relative">
                <summary className="flex min-h-11 cursor-pointer list-none items-center rounded-md border border-shell-border px-3 text-sm font-semibold text-shell-text hover:bg-shell-hover">
                  Menu
                </summary>
                <div className="absolute right-0 top-[calc(100%+0.5rem)] z-popover w-52 rounded-md border border-shell-border bg-shell-bg p-2 shadow-lg">
                  <NavigationLinks compact />
                </div>
              </details>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}
