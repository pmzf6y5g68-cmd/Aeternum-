import type { Metadata } from "next";
import { StatusCard } from "@/components/status-card";
import { suppressEmail } from "@/lib/suppression";
import { verifyUnsubscribe } from "@/lib/unsubscribe";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Désinscription", robots: { index: false } };

/** Lien de désinscription du pied de page : effet immédiat, sans connexion ni confirmation. */
export default async function UnsubscribePage({ searchParams }: { searchParams: Promise<{ t?: string }> }) {
  const { t } = await searchParams;
  const email = verifyUnsubscribe(t, process.env.UNSUBSCRIBE_SECRET ?? "");
  if (!email) return <StatusCard tone="neutral" title="Lien de désinscription invalide" />;
  await suppressEmail(email, "unsubscribe");
  return (
    <StatusCard tone="success" title="Vous êtes désinscrit">
      <p>Vous ne recevrez plus d&apos;emails de prospection de Rendez-vous à l&apos;adresse {email}.</p>
      <p>Une erreur ? Répondez simplement à notre dernier email.</p>
    </StatusCard>
  );
}
