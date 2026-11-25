import type { Metadata, Viewport } from "next";
import { AssistantWidget } from "@/components/assistant-widget";
import { Pwa } from "@/components/pwa";
import { siteConfig } from "@/config/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  applicationName: siteConfig.name,
  title: { default: `${siteConfig.name} — ${siteConfig.tagline}`, template: `%s · ${siteConfig.name}` },
  description:
    "Coiffeur, garage, coach, avocat, restaurant, plombier… Trouvez un professionnel près de chez vous et prenez rendez-vous en ligne 24 h/24.",
  appleWebApp: { capable: true, title: siteConfig.name, statusBarStyle: "default" },
  icons: { apple: [{ url: "/icons/180", sizes: "180x180", type: "image/png" }] },
  formatDetection: { telephone: false },
  openGraph: { type: "website", siteName: siteConfig.name, locale: "fr_FR" },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 } },
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined,
  },
  keywords: ["prise de rendez-vous en ligne", "réservation en ligne", "coiffeur", "barbier", "garage", "coach sportif", "avocat", "restaurant", "plombier", "institut de beauté"],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1758e6" },
    { media: "(prefers-color-scheme: dark)", color: "#0a2f86" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-dvh bg-canvas pb-[env(safe-area-inset-bottom)] font-sans text-ink antialiased">
        {children}
        <AssistantWidget />
        <Pwa />
      </body>
    </html>
  );
}
