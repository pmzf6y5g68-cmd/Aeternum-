/** Fournisseurs de connexion proposés. Activez-les dans Supabase › Authentication › Providers, puis listez-les dans NEXT_PUBLIC_AUTH_PROVIDERS. */
export const OAUTH_PROVIDERS = [
  { id: "google", label: "Continuer avec Google" },
  { id: "apple", label: "Continuer avec Apple" },
  { id: "azure", label: "Continuer avec Microsoft" },
  { id: "facebook", label: "Continuer avec Facebook" },
] as const;

export type OAuthProviderId = (typeof OAUTH_PROVIDERS)[number]["id"];

export function enabledProviders(raw: string | undefined = process.env.NEXT_PUBLIC_AUTH_PROVIDERS): (typeof OAUTH_PROVIDERS)[number][] {
  const wanted = (raw ?? "google,apple").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  return OAUTH_PROVIDERS.filter((p) => wanted.includes(p.id));
}
