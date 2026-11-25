import { Trash2, UserRound } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { fr } from "@/i18n/fr";
import { requireBusiness } from "@/lib/pro";
import type { Service, Staff } from "@/lib/supabase/types";
import { deleteStaff, upsertStaff } from "../actions";

function StaffForm({ member, services }: { member?: Staff; services: Pick<Service, "id" | "name">[] }) {
  return (
    <div className="card">
      <form action={upsertStaff} className="space-y-3">
        <input type="hidden" name="id" value={member?.id ?? ""} />
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
            <UserRound className="size-5" aria-hidden />
          </span>
          <div className="grid flex-1 gap-2 sm:grid-cols-2">
            <input name="name" required minLength={2} defaultValue={member?.name ?? ""} placeholder="Prénom (ex. Julie)" className="input" />
            <input name="title" defaultValue={member?.title ?? ""} placeholder="Rôle (ex. Coloriste)" className="input" />
          </div>
        </div>
        <fieldset>
          <legend className="label">Prestations réalisées (aucune cochée = toutes)</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {services.map((s) => (
              <label key={s.id} className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name="service_ids" value={s.id} defaultChecked={member?.service_ids.includes(s.id)} className="size-4 accent-[#1758E6]" />
                {s.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex items-center justify-between">
          <label className="inline-flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="active" defaultChecked={member?.active ?? true} className="size-4 accent-[#1758E6]" /> Réservable
          </label>
          <SubmitButton>{member ? fr.common.save : fr.common.add}</SubmitButton>
        </div>
      </form>
      {member && (
        <form action={deleteStaff} className="mt-2 text-right">
          <input type="hidden" name="id" value={member.id} />
          <button type="submit" className="btn-ghost px-2 text-sm text-danger">
            <Trash2 className="size-4" aria-hidden /> {fr.common.delete}
          </button>
        </form>
      )}
    </div>
  );
}

export default async function TeamPage() {
  const { supabase, business } = await requireBusiness();
  const [{ data: staff }, { data: services }] = await Promise.all([
    supabase.from("staff").select("*").eq("business_id", business.id).order("sort").returns<Staff[]>(),
    supabase.from("services").select("id, name").eq("business_id", business.id).order("sort").returns<Pick<Service, "id" | "name">[]>(),
  ]);
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{fr.dashboard.nav.team}</h1>
        <p className="text-sm text-ink-soft">
          Chaque membre prend un rendez-vous à la fois. Vos clients peuvent choisir « Peu importe » (le moins chargé est attribué) ou une personne précise. Sans
          membre, l&apos;agenda fonctionne comme une seule personne.
        </p>
      </div>
      {(staff ?? []).map((m) => (
        <StaffForm key={m.id} member={m} services={services ?? []} />
      ))}
      <StaffForm services={services ?? []} />
    </div>
  );
}
