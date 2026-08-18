"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * No planner a marca não leva a lugar nenhum: o link é público e enviar quem abre
 * para a tela de login do sistema interno seria um convite errado.
 */
export function BrandHome({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname?.startsWith("/planner")) {
    return <span className="block">{children}</span>;
  }

  return (
    <Link href="/login" aria-label="TreinaVISA" className="block rounded-md">
      {children}
    </Link>
  );
}
