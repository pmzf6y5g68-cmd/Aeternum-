import { CalendarOff, Trash2 } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { siteConfig } from "@/config/site";
import { fr } from "@/i18n/fr";
import { requireBusiness } from "@/lib/pro";
import type { OpeningHoursRow, Staff, TimeOffRow } from "@/lib/supabase/types";
import { addTimeOff, deleteTimeOff, updateHours } from "../actions";

const days = fr.business.days;
const hhmm = (v: string | null) => (v ? v.slice(0, 5) : "");
const fmt = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short", timeZone: siteConfig.booking.timeZone }).format(new Date(iso));

export default async function HoursPage() {
  const { supabase, business } = await requireBusiness();
  const [{ data: hours }, { data: offs }, { data: staff }] = await Promise.all([
    supabase.from("opening_hours").select("*").eq("business_id", business.id).returns<OpeningHoursRow[]>(),
    supabase.from("time_off").select("*").eq("business_id", business.id).gte("end_at", new Date().toISOString()).order("start_at").returns<TimeOffRow[]>(),
    supabase.from("staff").select("id, name").eq("business_id", business.id).eq("active", true).returns<Pick<Staff, "id" | "name">[]>(),
  ]);
  const byDay = new Map((hours ?? []).map((h) => [h.day_of_week, h]));
  const staffName = new Map((staff ?? []).map((s) => [s.id, s.name]));

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">{fr.dashboard.nav.hours}</h1>
      <section>
        <h2 className="mb-3 text-lg font-bold">Horaires d&apos;ouverture</h2>
        <form action={updateHours} className="card space-y-2">
          <div className="hidden grid-cols-[110px_80px_repeat(4,1fr)] gap-2 text-xs font-semibold text-ink-soft sm:grid">
            <span />
            <span />
            <span>Ouverture</span>
            <span>Fermeture</span>
            <span>Pause début</span>
            <span>Pause fin</span>
          </div>
          {[1, 2, 3, 4, 5, 6, 0].map((d) => {
            const h = byDay.get(d);
            return (
              <div key={d} className="grid grid-cols-2 items-center gap-2 border-b border-line pb-2 last:border-0 sm:grid-cols-[110px_80px_repeat(4,1fr)]">
                <span className="text-sm font-semibold">{days[d]}</span>
                <label className="inline-flex items-center gap-1.5 text-sm">
                  <input type="checkbox" name={`closed_${d}`} defaultChecked={h?.is_closed ?? true} className="size-4 accent-[#1758E6]" /> Fermé
                </label>
                <input type="time" name={`open_${d}`} aria-label="Ouverture" defaultValue={hhmm(h?.open_time ?? null)} className="input px-2 py-1.5 text-sm" />
                <input type="time" name={`close_${d}`} aria-label="Fermeture" defaultValue={hhmm(h?.close_time ?? null)} className="input px-2 py-1.5 text-sm" />
                <input type="time" name={`break_start_${d}`} aria-label="Pause début" defaultValue={hhmm(h?.break_start ?? null)} className="input px-2 py-1.5 text-sm" />
                <input type="time" name={`break_end_${d}`} aria-label="Pause fin" defaultValue={hhmm(h?.break_end ?? null)} className="input px-2 py-1.5 text-sm" />
              </div>
            );
          })}
          <div className="text-right">
            <SubmitButton>{fr.common.save}</SubmitButton>
          </div>
        </form>
      </section>

      <section>
        <h2 className="mb-1 flex items-center gap-2 text-lg font-bold">
          <CalendarOff className="size-5 text-brand" aria-hidden /> Congés & fermetures exceptionnelles
        </h2>
        <p className="mb-3 text-sm text-ink-soft">Les créneaux concernés disparaissent immédiatement de votre page et de la recherche.</p>
        <form action={addTimeOff} className="card grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="label">Du</label>
            <div className="flex gap-2">
              <input type="date" name="start_date" required className="input" />
              <input type="time" name="start_time" className="input w-28" aria-label="Heure de début (facultatif)" />
            </div>
          </div>
          <div>
            <label className="label">Au</label>
            <div className="flex gap-2">
              <input type="date" name="end_date" required className="input" />
              <input type="time" name="end_time" className="input w-28" aria-label="Heure de fin (facultatif)" />
            </div>
          </div>
          <div>
            <label className="label">Concerne</label>
            <select name="staff_id" className="input">
              <option value="">Tout l&apos;établissement</option>
              {(staff ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label">Motif (privé)</label>
            <input name="reason" maxLength={120} placeholder="Vacances, formation…" className="input" />
          </div>
          <div className="flex items-end justify-end">
            <SubmitButton>{fr.common.add}</SubmitButton>
          </div>
        </form>
        {(offs ?? []).length > 0 && (
          <ul className="mt-3 space-y-2">
            {(offs ?? []).map((o) => (
              <li key={o.id} className="card flex items-center justify-between gap-3 p-3 text-sm">
                <span>
                  <span className="font-semibold">
                    {fmt(o.start_at)} → {fmt(o.end_at)}
                  </span>
                  <span className="text-ink-soft"> · {o.staff_id ? staffName.get(o.staff_id) ?? "Membre" : "Tout l'établissement"}{o.reason ? ` · ${o.reason}` : ""}</span>
                </span>
                <form action={deleteTimeOff}>
                  <input type="hidden" name="id" value={o.id} />
                  <button type="submit" className="btn-ghost px-2 text-danger" aria-label={fr.common.delete}>
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
