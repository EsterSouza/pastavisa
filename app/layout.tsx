import type { Metadata } from "next";
import { Sora, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-sora",
  display: "swap",
});

const sourceSans3 = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-source-sans-3",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PastaVISA | TreinaVISA",
  description: "Sistema de automação de documentos sanitários da TreinaVISA.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${sourceSans3.variable} ${sora.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
