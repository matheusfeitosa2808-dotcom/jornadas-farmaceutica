import type { Metadata, Viewport } from "next";
import { Provider } from "@/components/provider";
import Pwa from "@/components/pwa";
import "./globals.css";
import "./dev-hidden.css";
export const metadata: Metadata = {
  title: {
    default: "Jornadas · Farmácia em movimento",
    template: "%s · Jornadas",
  },
  description:
    "Sua programação, seu passaporte e cada conquista da Jornada Farmacêutica.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/icon-192.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Jornadas" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#174f58",
  viewportFit: "cover",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body>
        <a href="#main" className="skip-link">
          Ir para o conteúdo
        </a>
        <Provider>{children}</Provider>
        <Pwa />
      </body>
    </html>
  );
}
