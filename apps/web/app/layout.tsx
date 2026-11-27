import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { Providers } from "#components/providers";
import "./globals.css";

const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-sans" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" });

export const metadata: Metadata = {
  // Cada rota define só o próprio nome; o template acrescenta o sufixo ("Dashboard - Data Track").
  title: { default: "Data Track", template: "%s - Data Track" },
  icons: { apple: "/data-track-simple-logo.png" },
};

// viewportFit "cover" habilita env(safe-area-inset-*) para a barra inferior no iOS.
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${mono.variable}`}>
      <body className="min-h-dvh" cz-shortcut-listen="true">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
