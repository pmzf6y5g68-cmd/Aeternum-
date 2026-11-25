import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { MagicLinkForm } from "@/components/magic-link-form";
import { fr } from "@/i18n/fr";
import { getCurrentUser } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  const { user } = await getCurrentUser();
  if (user) redirect(target);

  return (
    <main className="grid min-h-dvh place-items-center bg-muted px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="card p-7">
          <h1 className="text-xl font-bold">{fr.login.title}</h1>
          <p className="mb-6 mt-1.5 text-sm text-slate-600">{fr.login.subtitle}</p>
          <MagicLinkForm next={target} />
        </div>
      </div>
    </main>
  );
}
