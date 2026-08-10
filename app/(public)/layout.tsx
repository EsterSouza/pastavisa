import type { ReactNode } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-page">
      <header className="brand-dark border-b border-brand-deep bg-brand-deep px-4 py-4 sm:px-6">
        <Link href="/login" aria-label="TreinaVISA" className="mx-auto block w-fit rounded-md">
          <BrandLogo priority />
        </Link>
      </header>
      <main className="mx-auto flex min-h-[calc(100vh-5.5rem)] w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        {children}
      </main>
    </div>
  );
}
