import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { MagicLinkForm } from "@/components/magic-link-form";
import { OAuthButtons } from "@/components/oauth-buttons";
import { fr } from "@/i18n/fr";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const target = next?.startsWith("/") && !next.startsWith("//") ? next : "/compte";
  const { user } = await getCurrentUser().catch(() => ({ user: null }));
  if (user) redirect(target);

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="card p-7">
          <h1 className="text-xl font-bold">{fr.login.title}</h1>
          <p className="mb-6 mt-1.5 text-sm text-ink-soft">{fr.login.subtitle}</p>
          {error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-medium text-danger">La connexion n&apos;a pas abouti. Réessayez ou utilisez votre email.</p>}
          <OAuthButtons next={target} />
          <MagicLinkForm next={target} />
          <p className="mt-6 text-center text-xs text-ink-soft">
            En continuant, vous acceptez les{" "}
            <a href="/cgu" className="underline">
              conditions d&apos;utilisation
            </a>{" "}
            et la{" "}
            <a href="/confidentialite" className="underline">
              politique de confidentialité
            </a>
            .
          </p>
        </div>
      </div>
    </main>
  );
}
