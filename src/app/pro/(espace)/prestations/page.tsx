import { Trash2 } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { getCategory } from "@/config/categories";
import { fr } from "@/i18n/fr";
import { requireBusiness } from "@/lib/pro";
import type { Addon, Business, Service } from "@/lib/supabase/types";
import { deleteAddon, deleteService, upsertAddon, upsertService } from "../actions";

const VARIANT_ROWS = 6;

function ServiceForm({ service, business, variantLabel }: { service?: Service; business: Business; variantLabel: string | null }) {
  const variants = service?.variants ?? [];
  return (
    <details className="card group p-0" open={!service}>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4">
        <span>
          <span className="block font-bold">{service?.name ?? "+ Nouvelle prestation"}</span>
          {service && (
            <span className="text-sm text-ink-soft">
              {Number(service.price_eur)} € · {service.duration_minutes} min
              {variants.length ? ` · ${variants.length} variantes` : ""}
              {service.capacity > 1 ? ` · ${service.capacity} places` : ""}
              {!service.active ? " · inactive" : ""}
            </span>
          )}
        </span>
        <span className="text-sm font-semibold text-brand group-open:hidden">{fr.common.edit}</span>
      </summary>
      <div className="border-t border-line p-4">
        <form action={upsertService} className="space-y-4">
          <input type="hidden" name="id" value={service?.id ?? ""} />
          <div className="grid gap-3 sm:grid-cols-[1fr_120px_120px_110px]">
            <div>
              <label className="label">Nom</label>
              <input name="name" required defaultValue={service?.name ?? ""} className="input" />
            </div>
            <div>
              <label className="label">Prix (€)</label>
              <input name="price_eur" type="number" min={0} step="0.01" required defaultValue={service?.price_eur ?? ""} className="input" />
            </div>
            <div>
              <label className="label">Durée (min)</label>
              <input name="duration_minutes" type="number" min={5} step={5} required defaultValue={service?.duration_minutes ?? 60} className="input" />
            </div>
            <div>
              <label className="label" title="Nombre de clients au même créneau (cours collectif, tables…)">Places</label>
              <input name="capacity" type="number" min={1} max={500} defaultValue={service?.capacity ?? 1} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Description</label>
            <input name="description" defaultValue={service?.description ?? ""} className="input" />
          </div>
          <fieldset>
            <legend className="label">Variantes de prix et de durée {variantLabel ? `(${variantLabel.toLowerCase()})` : ""} — facultatif</legend>
            <div className="space-y-2">
              {Array.from({ length: VARIANT_ROWS }, (_, i) => {
                const v = variants[i];
                return (
                  <div key={i} className="grid grid-cols-[1fr_90px_90px] gap-2">
                    <input name={`variant_label_${i}`} defaultValue={v?.label ?? ""} placeholder="Libellé (ex. Cheveux longs)" className="input py-2 text-sm" />
                    <input name={`variant_price_${i}`} type="number" min={0} step="0.01" defaultValue={v?.price_eur ?? ""} placeholder="€" className="input py-2 text-sm" />
                    <input name={`variant_duration_${i}`} type="number" min={5} step={5} defaultValue={v?.duration_minutes ?? ""} placeholder="min" className="input py-2 text-sm" />
                  </div>
                );
              })}
            </div>
          </fieldset>
          {business.modes.length > 1 && (
            <fieldset>
              <legend className="label">Disponible (vide = partout où vous intervenez)</legend>
              <div className="flex flex-wrap gap-3">
                {business.modes.map((m) => (
                  <label key={m} className="inline-flex items-center gap-2 text-sm">
                    <input type="checkbox" name="modes" value={m} defaultChecked={service?.modes.includes(m)} className="size-4 accent-[#1758E6]" />
                    {fr.modes[m]}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <div className="flex items-center justify-between gap-3">
            <label className="inline-flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name="active" defaultChecked={service?.active ?? true} className="size-4 accent-[#1758E6]" />
              Réservable en ligne
            </label>
            <SubmitButton>{service ? fr.common.save : fr.common.add}</SubmitButton>
          </div>
        </form>
        {service && (
          <form action={deleteService} className="mt-2 text-right">
            <input type="hidden" name="id" value={service.id} />
            <button type="submit" className="btn-ghost px-2 text-sm text-danger">
              <Trash2 className="size-4" aria-hidden /> {fr.common.delete}
            </button>
          </form>
        )}
      </div>
    </details>
  );
}

function AddonForm({ addon }: { addon?: Addon }) {
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line p-3">
      <form action={upsertAddon} className="flex flex-1 flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={addon?.id ?? ""} />
        <div className="min-w-40 flex-1">
          <label className="label">Nom</label>
          <input name="name" required defaultValue={addon?.name ?? ""} placeholder="Nouvelle option" className="input" />
        </div>
        <div className="w-24">
          <label className="label">Prix (€)</label>
          <input name="price_eur" type="number" min={0} step="0.01" required defaultValue={addon?.price_eur ?? ""} className="input" />
        </div>
        <div className="w-24">
          <label className="label">Durée</label>
          <input name="duration_minutes" type="number" min={0} step={5} required defaultValue={addon?.duration_minutes ?? 0} className="input" />
        </div>
        <label className="mb-3 inline-flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="active" defaultChecked={addon?.active ?? true} className="size-4 accent-[#1758E6]" /> Actif
        </label>
        <SubmitButton className="btn-secondary">{addon ? fr.common.save : fr.common.add}</SubmitButton>
      </form>
      {addon && (
        <form action={deleteAddon}>
          <input type="hidden" name="id" value={addon.id} />
          <button type="submit" className="btn-ghost px-2 text-danger" aria-label={fr.common.delete}>
            <Trash2 className="size-4" aria-hidden />
          </button>
        </form>
      )}
    </div>
  );
}

export default async function ServicesPage() {
  const { supabase, business } = await requireBusiness();
  const [{ data: services }, { data: addons }] = await Promise.all([
    supabase.from("services").select("*").eq("business_id", business.id).order("sort").order("price_eur").returns<Service[]>(),
    supabase.from("addons").select("*").eq("business_id", business.id).order("price_eur").returns<Addon[]>(),
  ]);
  const variantLabel = getCategory(business.category)?.variantLabel ?? null;
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{fr.dashboard.nav.services}</h1>
        <p className="text-sm text-ink-soft">Prix, durées, variantes, places par créneau et lieux d&apos;intervention : le prix final est toujours recalculé côté serveur.</p>
      </div>
      <section className="space-y-3">
        {(services ?? []).map((s) => (
          <ServiceForm key={s.id} service={s} business={business} variantLabel={variantLabel} />
        ))}
        <ServiceForm business={business} variantLabel={variantLabel} />
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-bold">Options (upsell)</h2>
        {business.plan !== "pro" && <p className="text-sm text-ink-soft">Les options sont proposées aux clients avec le plan Pro.</p>}
        <div className="card space-y-2">
          {(addons ?? []).map((a) => (
            <AddonForm key={a.id} addon={a} />
          ))}
          <AddonForm />
        </div>
      </section>
    </div>
  );
}
