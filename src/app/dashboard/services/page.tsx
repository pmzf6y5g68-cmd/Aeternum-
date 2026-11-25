import { Trash2 } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { fr } from "@/i18n/fr";
import { VEHICLE_SIZES } from "@/lib/domain/pricing";
import { requireStudio } from "@/lib/studio";
import type { Addon, OpeningHoursRow, Service } from "@/lib/supabase/types";
import { deleteAddon, deleteService, updateHours, updateZone, upsertAddon, upsertService } from "../actions";

const t = fr.dashboard.services;

function hhmm(value: string | null): string {
  return value ? value.slice(0, 5) : "";
}

function ServiceForm({ service }: { service?: Service }) {
  return (
    <div className="card">
      <form action={upsertService} className="space-y-3">
        <input type="hidden" name="id" value={service?.id ?? ""} />
        <div className="grid gap-3 sm:grid-cols-[1fr_120px_120px]">
          <div>
            <label className="label">{t.name}</label>
            <input name="name" required defaultValue={service?.name ?? ""} placeholder={t.newService} className="input" />
          </div>
          <div>
            <label className="label">{t.basePrice}</label>
            <input name="base_price_eur" type="number" min={0} step="0.01" required defaultValue={service?.base_price_eur ?? ""} className="input" />
          </div>
          <div>
            <label className="label">{t.baseDuration}</label>
            <input name="base_duration_minutes" type="number" min={15} step={15} required defaultValue={service?.base_duration_minutes ?? 60} className="input" />
          </div>
        </div>
        <div>
          <label className="label">{t.description}</label>
          <input name="description" defaultValue={service?.description ?? ""} className="input" />
        </div>
        <fieldset>
          <legend className="label">{t.sizePricing}</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {VEHICLE_SIZES.map((size) => (
              <div key={size} className="rounded-xl bg-muted p-3">
                <p className="mb-2 text-xs font-semibold text-slate-600">{fr.vehicleSizes[size]}</p>
                <div className="grid grid-cols-2 gap-2">
                  <input name={`price_${size}`} type="number" min={0} step="0.01" aria-label={`${t.price} ${size}`} placeholder="€" defaultValue={service?.size_pricing_json?.[size]?.price_eur ?? ""} className="input px-2 py-1.5 text-sm" />
                  <input name={`duration_${size}`} type="number" min={15} step={15} aria-label={`${t.duration} ${size}`} placeholder="min" defaultValue={service?.size_pricing_json?.[size]?.duration_minutes ?? ""} className="input px-2 py-1.5 text-sm" />
                </div>
              </div>
            ))}
          </div>
        </fieldset>
        <div className="flex items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" name="active" defaultChecked={service?.active ?? true} className="size-4 accent-[#0F766E]" />
            {t.active}
          </label>
          <SubmitButton>{service ? fr.common.save : fr.common.add}</SubmitButton>
        </div>
      </form>
      {service && (
        <form action={deleteService} className="mt-2 text-right">
          <input type="hidden" name="id" value={service.id} />
          <button type="submit" className="btn-ghost px-2 text-sm text-red-600">
            <Trash2 className="size-4" aria-hidden /> {fr.common.delete}
          </button>
        </form>
      )}
    </div>
  );
}

function AddonForm({ addon }: { addon?: Addon }) {
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 p-3">
      <form action={upsertAddon} className="flex flex-1 flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={addon?.id ?? ""} />
        <div className="min-w-40 flex-1">
          <label className="label">{t.name}</label>
          <input name="name" required defaultValue={addon?.name ?? ""} placeholder={t.newAddon} className="input" />
        </div>
        <div className="w-24">
          <label className="label">{t.price}</label>
          <input name="price_eur" type="number" min={0} step="0.01" required defaultValue={addon?.price_eur ?? ""} className="input" />
        </div>
        <div className="w-24">
          <label className="label">{t.duration}</label>
          <input name="duration_minutes" type="number" min={0} step={5} required defaultValue={addon?.duration_minutes ?? 0} className="input" />
        </div>
        <label className="mb-3 inline-flex items-center gap-1.5 text-sm">
          <input type="checkbox" name="active" defaultChecked={addon?.active ?? true} className="size-4 accent-[#0F766E]" />
          {t.active}
        </label>
        <SubmitButton className="btn-secondary">{addon ? fr.common.save : fr.common.add}</SubmitButton>
      </form>
      {addon && (
        <form action={deleteAddon}>
          <input type="hidden" name="id" value={addon.id} />
          <button type="submit" className="btn-ghost px-2 text-red-600" aria-label={fr.common.delete}>
            <Trash2 className="size-4" aria-hidden />
          </button>
        </form>
      )}
    </div>
  );
}

export default async function ServicesPage() {
  const { supabase, studio } = await requireStudio();
  const [{ data: services }, { data: addons }, { data: hours }] = await Promise.all([
    supabase.from("services").select("*").eq("studio_id", studio.id).order("base_price_eur").returns<Service[]>(),
    supabase.from("addons").select("*").eq("studio_id", studio.id).order("price_eur").returns<Addon[]>(),
    supabase.from("opening_hours").select("*").eq("studio_id", studio.id).returns<OpeningHoursRow[]>(),
  ]);
  const hoursByDay = new Map((hours ?? []).map((h) => [h.day_of_week, h]));
  const weekOrder = [1, 2, 3, 4, 5, 6, 0];

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t.servicesTitle}</h2>
        {(services ?? []).map((s) => (
          <ServiceForm key={s.id} service={s} />
        ))}
        <ServiceForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t.addonsTitle}</h2>
        {studio.plan !== "pro" && <p className="text-sm text-slate-500">{t.addonsProOnly}</p>}
        <div className="card space-y-2">
          {(addons ?? []).map((a) => (
            <AddonForm key={a.id} addon={a} />
          ))}
          <AddonForm />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t.zoneTitle}</h2>
        <form action={updateZone} className="card grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label">{t.serviceMode}</label>
            <select name="service_mode" defaultValue={studio.service_mode} className="input">
              {(["workshop", "mobile", "both"] as const).map((m) => (
                <option key={m} value={m}>
                  {fr.serviceModes[m]}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">{t.address}</label>
            <input name="address" required defaultValue={studio.address ?? ""} className="input" />
          </div>
          <div>
            <label className="label">{t.freeRadius}</label>
            <input name="free_radius_km" type="number" min={0} step="0.5" defaultValue={studio.free_radius_km} className="input" />
          </div>
          <div>
            <label className="label">{t.maxRadius}</label>
            <input name="max_radius_km" type="number" min={0} step="0.5" defaultValue={studio.max_radius_km} className="input" />
          </div>
          <div>
            <label className="label">{t.pricePerKm}</label>
            <input name="price_per_extra_km" type="number" min={0} step="0.05" defaultValue={studio.price_per_extra_km} className="input" />
          </div>
          <div>
            <label className="label">{t.travelBuffer}</label>
            <input name="travel_buffer_minutes" type="number" min={0} step={5} defaultValue={studio.travel_buffer_minutes} className="input" />
          </div>
          <div>
            <label className="label">{t.rebookingDays}</label>
            <input name="rebooking_days" type="number" min={7} max={730} defaultValue={studio.rebooking_days} className="input" />
          </div>
          <div className="flex items-end justify-end">
            <SubmitButton>{fr.common.save}</SubmitButton>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">{t.hoursTitle}</h2>
        <form action={updateHours} className="card space-y-2">
          {weekOrder.map((day) => {
            const h = hoursByDay.get(day);
            return (
              <div key={day} className="grid grid-cols-2 items-center gap-2 border-b border-slate-100 pb-2 last:border-0 sm:grid-cols-[110px_90px_repeat(4,1fr)]">
                <span className="text-sm font-medium">{t.days[day]}</span>
                <label className="inline-flex items-center gap-1.5 text-sm">
                  <input type="checkbox" name={`closed_${day}`} defaultChecked={h?.is_closed ?? true} className="size-4 accent-[#0F766E]" />
                  {t.closed}
                </label>
                <input type="time" name={`open_${day}`} aria-label={t.open} defaultValue={hhmm(h?.open_time ?? null)} className="input px-2 py-1.5 text-sm" />
                <input type="time" name={`close_${day}`} aria-label={t.close} defaultValue={hhmm(h?.close_time ?? null)} className="input px-2 py-1.5 text-sm" />
                <input type="time" name={`break_start_${day}`} aria-label={t.breakStart} defaultValue={hhmm(h?.break_start ?? null)} className="input px-2 py-1.5 text-sm" />
                <input type="time" name={`break_end_${day}`} aria-label={t.breakEnd} defaultValue={hhmm(h?.break_end ?? null)} className="input px-2 py-1.5 text-sm" />
              </div>
            );
          })}
          <p className="text-xs text-slate-500">
            {t.open} · {t.close} · {t.breakStart} · {t.breakEnd}
          </p>
          <div className="text-right">
            <SubmitButton>{fr.common.save}</SubmitButton>
          </div>
        </form>
      </section>
    </div>
  );
}
