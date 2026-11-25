import Link from "next/link";
import { MapPin, Monitor, House } from "lucide-react";
import { getCategory } from "@/config/categories";
import { format } from "@/i18n";
import { fr } from "@/i18n/fr";
import { eurToCents, formatEur } from "@/lib/domain/pricing";
import { BusinessAvatar } from "../business-avatar";
import { Stars } from "../stars";
import type { SerializedResult } from "./types";

const t = fr.search;
const SLOTS_PER_DAY = 4;

function dayHeader(date: string): { weekday: string; day: string } {
  const d = new Date(`${date}T12:00:00Z`);
  return {
    weekday: new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" }).format(d),
    day: new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(d),
  };
}

function longDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(iso));
}

export function ResultCard({ r, active, onHover }: { r: SerializedResult; active: boolean; onHover?: (id: string | null) => void }) {
  const category = getCategory(r.category);
  const hasSlots = r.preview.some((d) => d.slots.length > 0);
  return (
    <article
      id={`r-${r.id}`}
      onMouseEnter={() => onHover?.(r.id)}
      onMouseLeave={() => onHover?.(null)}
      className={`card grid gap-5 p-4 transition md:grid-cols-[1fr_minmax(0,20rem)] md:p-5 ${active ? "border-brand ring-2 ring-brand/20" : ""}`}
    >
      <div className="flex gap-4">
        <BusinessAvatar name={r.name} category={r.category} coverUrl={r.cover_url} />
        <div className="min-w-0 space-y-1">
          <Link href={r.path} className="block text-lg font-bold leading-snug text-brand hover:underline">
            {r.name}
          </Link>
          <p className="flex items-center gap-2 text-sm font-medium text-ink">
            {category?.label}
            {r.sponsored && (
              <span className="rounded bg-sun/30 px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ink" title="Établissement abonné Pro, mis en avant dans le tri « Pertinence »">
                Mis en avant
              </span>
            )}
          </p>
          {r.tagline && <p className="line-clamp-1 text-sm text-ink-soft">{r.tagline}</p>}
          <p className="flex items-start gap-1.5 text-sm text-ink-soft">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span className="line-clamp-2">
              {r.address ?? r.city}
              {r.distance_km !== null && <span className="font-semibold text-ink"> · {r.distance_km < 1 ? `${Math.round(r.distance_km * 1000)} m` : `${r.distance_km.toFixed(1).replace(".", ",")} km`}</span>}
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
            <Stars rating={r.rating_avg} count={r.rating_count} />
            {r.rating_count === 0 && <span className="rounded bg-brand-soft px-1.5 py-0.5 text-xs font-semibold text-brand">{fr.common.newBadge}</span>}
            {r.min_price_eur !== null && (
              <span className="text-sm text-ink-soft">
                {fr.common.from} <span className="font-semibold text-ink">{Number(r.min_price_eur) === 0 ? fr.common.free : formatEur(eurToCents(r.min_price_eur))}</span>
              </span>
            )}
            {r.modes.includes("at_home") && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft">
                <House className="size-3.5" aria-hidden /> {fr.modes.at_home}
              </span>
            )}
            {r.modes.includes("online") && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-soft">
                <Monitor className="size-3.5" aria-hidden /> {fr.modes.online}
              </span>
            )}
          </div>
          <Link href={`${r.path}#reserver`} className="btn-primary mt-3 w-full py-2 text-sm md:w-auto">
            {t.book}
          </Link>
        </div>
      </div>

      <div className="border-t border-line pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0">
        {hasSlots ? (
          <>
            <div className="grid grid-cols-4 gap-2">
              {r.preview.map((d) => {
                const h = dayHeader(d.date);
                return (
                  <div key={d.date} className="space-y-1.5 text-center">
                    <p className="text-xs leading-tight">
                      <span className="block font-semibold capitalize">{h.weekday}</span>
                      <span className="text-ink-soft">{h.day}</span>
                    </p>
                    {d.slots.slice(0, SLOTS_PER_DAY).map((s) => (
                      <Link key={s.startAt} href={`${r.path}?date=${d.date}#reserver`} className="slot px-1 text-xs">
                        {s.time}
                      </Link>
                    ))}
                    {d.slots.length === 0 && <span className="block py-2 text-xs text-slate-300">—</span>}
                  </div>
                );
              })}
            </div>
            <Link href={`${r.path}#reserver`} className="mt-3 block text-center text-sm font-semibold text-brand hover:underline">
              {t.moreSlots}
            </Link>
          </>
        ) : r.nextSlotAt ? (
          <Link href={`${r.path}#reserver`} className="flex h-full items-center justify-center rounded-lg bg-brand-softer p-4 text-center text-sm font-semibold text-brand hover:bg-brand-soft">
            {format(t.nextAvailable, { date: longDate(r.nextSlotAt) })}
          </Link>
        ) : (
          <p className="flex h-full items-center justify-center rounded-lg bg-canvas p-4 text-center text-sm text-ink-soft">{t.noAvailability}</p>
        )}
      </div>
    </article>
  );
}
