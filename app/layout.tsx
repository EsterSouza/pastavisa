import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Link from "next/link";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PastaVISA",
  description: "Sistema de automação de documentos sanitários",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${inter.className} bg-gray-50 min-h-screen`}>
        <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
          <Link href="/" className="font-bold text-blue-700 text-lg tracking-tight">
            PastaVISA
          </Link>
          <Link href="/pasta/nova" className="text-sm text-gray-600 hover:text-blue-600">
            Nova Pasta
          </Link>
          <Link href="/templates" className="text-sm text-gray-600 hover:text-blue-600">
            Templates
          </Link>
          <Link href="/legislacoes" className="text-sm text-gray-600 hover:text-blue-600">
            Legislações
          </Link>
        </nav>
        <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
