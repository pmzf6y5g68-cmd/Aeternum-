import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/logo";
import { signOut } from "@/lib/auth-actions";
import { getCurrentUser } from "@/lib/supabase/server";
import { MfaChallenge } from "./challenge";

export const metadata: Metadata = { title: "Vérification en deux étapes", robots: { index: false } };

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = next?.startsWith("/") && !next.startsWith("//") && !next.startsWith("/auth/") ? next : "/compte";
  const { user } = await getCurrentUser().catch(() => ({ user: null }));
  if (!user) redirect(`/login?next=${encodeURIComponent(target)}`);

  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="card p-7">
          <h1 className="text-xl font-bold">Vérification en deux étapes</h1>
          <p className="mb-6 mt-1.5 text-sm text-ink-soft">{user.email}</p>
          <MfaChallenge next={target} />
          <form action={signOut} className="mt-4 text-center">
            <button type="submit" className="text-sm font-semibold text-ink-soft hover:underline">
              Se connecter avec un autre compte
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
