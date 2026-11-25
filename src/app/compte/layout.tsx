import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { fr } from "@/i18n/fr";
import { signOut } from "@/lib/auth-actions";
import { getCurrentUser } from "@/lib/supabase/server";
import { AccountTabs } from "./tabs";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const { user } = await getCurrentUser();
  if (!user) redirect("/login?next=/compte");
  return (
    <>
      <SiteHeader variant="white" />
      <main className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{fr.account.title}</h1>
            <p className="text-sm text-ink-soft">{user.email}</p>
          </div>
          <form action={signOut}>
            <button type="submit" className="btn-ghost text-sm">
              <LogOut className="size-4" aria-hidden /> <span className="hidden sm:inline">{fr.common.logout}</span>
            </button>
          </form>
        </div>
        <AccountTabs />
        <div className="mt-5">{children}</div>
        <p className="mt-10 text-center text-sm text-ink-soft">
          {fr.common.forPros}{" "}
          <Link href="/pro" className="font-semibold text-brand hover:underline">
            {fr.pro.cta}
          </Link>
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
