import type { NextConfig } from "next";

// form-action volontairement absent : la connexion Google / Apple redirige vers les fournisseurs après l'envoi du formulaire.
const baseCsp = "base-uri 'self'; object-src 'none'; upgrade-insecure-requests";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(self \"https://js.stripe.com\"), interest-cohort=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
        ],
      },
      {
        // Tout le site refuse d'être affiché dans un cadre (anti-clickjacking)…
        source: "/((?!widget/).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: `${baseCsp}; frame-ancestors 'none'` },
        ],
      },
      {
        // … sauf le module de réservation, conçu pour être intégré sur le site des professionnels.
        source: "/widget/:path*",
        headers: [{ key: "Content-Security-Policy", value: `${baseCsp}; frame-ancestors *` }],
      },
      {
        source: "/embed.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "public, max-age=3600, stale-while-revalidate=86400" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
