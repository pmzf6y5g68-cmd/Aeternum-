import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { z } from "zod";
import { StatusCard } from "@/components/status-card";
import { SubmitButton } from "@/components/submit-button";
import { logEvent } from "@/lib/events";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Retirer une fiche", robots: { index: false } };

async function optOut(formData: FormData): Promise<void> {
  "use server";
  const id = z.uuid().safeParse(String(formData.get("id") ?? ""));
  if (!id.success) redirect("/");
  // Droit d'opposition : retrait immédiat et définitif (un nouvel import ne la remet pas en ligne).
  await createAdminClient().from("directory_listings").update({ opted_out_at: new Date().toISOString() }).eq("id", id.data).is("opted_out_at", null);
  await logEvent("directory.optOut", "fiche retirée", { listing_id: id.data }, "info");
  redirect(`/annuaire/retrait/${id.data}?fait=1`);
}

export default async function OptOutPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ fait?: string }> }) {
  const { id } = await params;
  const { fait } = await searchParams;
  if (fait) {
    return (
      <StatusCard tone="success" title="Fiche retirée">
        <p>Elle n&apos;apparaît plus sur Rendez-vous et ne sera pas réimportée.</p>
      </StatusCard>
    );
  }
  if (!z.uuid().safeParse(id).success) return <StatusCard tone="neutral" title="Lien invalide." />;
  const { data } = await createAdminClient().from("directory_listings").select("id, name, city").eq("id", id).is("opted_out_at", null).maybeSingle<{ id: string; name: string; city: string | null }>();
  if (!data) return <StatusCard tone="neutral" title="Cette fiche n'est plus en ligne." />;
  return (
    <StatusCard tone="warning" title="Retirer cette fiche ?">
      <p>
        <strong>{data.name}</strong>
        {data.city ? ` (${data.city})` : ""} est affiché à titre informatif, à partir des données publiques d&apos;OpenStreetMap. Vous pouvez le retirer de Rendez-vous à tout moment.
      </p>
      <form action={optOut} className="pt-2">
        <input type="hidden" name="id" value={data.id} />
        <SubmitButton className="btn-primary w-full bg-danger hover:bg-red-700">Retirer la fiche</SubmitButton>
      </form>
      <p className="text-xs">Vous préférez recevoir des réservations ? Activez plutôt votre page gratuitement depuis la fiche.</p>
    </StatusCard>
  );
}
