import type { Metadata } from "next";
import { LogOut, Mail } from "lucide-react";
import { signOutEverywhere } from "@/lib/auth-actions";
import { getCurrentUser } from "@/lib/supabase/server";
import { SecurityPanel } from "./security-panel";

export const metadata: Metadata = { title: "Sécurité", robots: { index: false } };

const PROVIDER_LABELS: Record<string, string> = { email: "Email", google: "Google", apple: "Apple", azure: "Microsoft", facebook: "Facebook" };

export default async function SecurityPage() {
  const { user } = await getCurrentUser();
  const providers = Array.from(new Set((user?.identities ?? []).map((i) => i.provider)));
  return (
    <div className="space-y-5">
      <section className="card">
        <h2 className="flex items-center gap-2 font-bold">
          <Mail className="size-4 text-brand" aria-hidden /> Méthodes de connexion
        </h2>
        <p className="mt-1 text-sm text-ink-soft">{user?.email}</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {(providers.length ? providers : ["email"]).map((p) => (
            <li key={p} className="rounded-full bg-canvas px-3 py-1 text-sm font-medium">
              {PROVIDER_LABELS[p] ?? p}
            </li>
          ))}
        </ul>
      </section>
      <SecurityPanel />
      <section className="card">
        <h2 className="font-bold">Sessions</h2>
        <p className="mt-1 text-sm text-ink-soft">Un appareil perdu ou un doute ? Déconnectez votre compte de tous les appareils (téléphone, ordinateur, application).</p>
        <form action={signOutEverywhere} className="mt-4">
          <button type="submit" className="btn-secondary">
            <LogOut className="size-4" aria-hidden /> Se déconnecter partout
          </button>
        </form>
      </section>
    </div>
  );
}
