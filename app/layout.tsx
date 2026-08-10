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
  icons: {
    icon: [
      { url: "/brand/favicon-light.png", media: "(prefers-color-scheme: light)" },
      { url: "/brand/favicon-dark.png", media: "(prefers-color-scheme: dark)" },
    ],
  },
};

const themeBootScript = `try{var t=localStorage.getItem("pastavisa-theme");document.documentElement.dataset.theme=t==="light"||t==="dark"?t:matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}catch(e){document.documentElement.dataset.theme="light"}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className={`${sourceSans3.variable} ${sora.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
