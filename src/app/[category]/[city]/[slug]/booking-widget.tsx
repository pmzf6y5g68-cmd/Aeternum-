"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, House, Loader2, MapPin, Minus, Monitor, Pencil, Plus, Store, UserRound, Users } from "lucide-react";
import type { LocationMode } from "@/config/categories";
import { format } from "@/i18n";
import { fr } from "@/i18n/fr";
import { computeQuote, formatDuration, formatEur, servicePrice, startingPriceCents, type BusinessForPricing } from "@/lib/domain/pricing";
import type { Addon, Service } from "@/lib/supabase/types";

const t = fr.booking;

export interface WidgetBusiness {
  slug: string;
  path: string;
  name: string;
  modes: LocationMode[];
  address: string | null;
  pricing: BusinessForPricing;
}

interface Slot {
  time: string;
  startAt: string;
  remaining: number | null;
}

interface DayData {
  date: string;
  slots: Slot[];
}

type StepKey = "service" | "variant" | "location" | "staff" | "addons" | "seats" | "slot" | "contact";

const MODE_ICON = { on_site: Store, at_home: House, online: Monitor } as const;
const ERRORS: Record<string, string> = {
  slot_taken: t.slotTaken,
  quota_exceeded: t.quotaExceeded,
  out_of_zone: t.outOfZone,
  address_not_found: t.addressNotFound,
  blocked_no_show: t.blocked,
  rate_limited: "Trop de tentatives en peu de temps. Patientez quelques minutes puis réessayez.",
};

function Waitlist({ businessSlug, serviceId, from, prefill }: { businessSlug: string; serviceId: string | null; from: string; prefill: { name: string; email: string } }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(prefill);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  if (state === "done") return <p className="mt-3 rounded-lg bg-green-50 p-3 text-center text-sm font-semibold text-success">{t.waitlistDone}</p>;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 w-full text-center text-sm font-semibold text-brand hover:underline">
        {t.waitlistCta}
      </button>
    );
  }
  return (
    <form
      className="mt-3 space-y-2 rounded-lg border border-line bg-canvas p-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setState("busy");
        const res = await fetch("/api/waitlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ business: businessSlug, service_id: serviceId, name: form.name, email: form.email, date_from: from, days: 14 }),
        }).catch(() => null);
        setState(res?.ok ? "done" : "error");
      }}
    >
      <p className="text-sm font-bold">{t.waitlistTitle}</p>
      <input required minLength={2} placeholder={t.name} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input py-2 text-sm" />
      <input required type="email" placeholder={t.email} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input py-2 text-sm" />
      {state === "error" && <p className="text-xs text-danger">{fr.common.error}</p>}
      <button type="submit" disabled={state === "busy"} className="btn-secondary w-full py-2 text-sm">
        {t.waitlistSubmit}
      </button>
    </form>
  );
}

/** Origine du client : « direct » s'il est arrivé par le lien du professionnel (?via=pro), sinon marketplace. */
function readSource(slug: string): "direct" | "marketplace" {
  try {
    return sessionStorage.getItem(`rdv_src_${slug}`) === "direct" ? "direct" : "marketplace";
  } catch {
    return "marketplace";
  }
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dayLabel(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  return {
    weekday: new Intl.DateTimeFormat("fr-FR", { weekday: "short", timeZone: "UTC" }).format(d),
    day: new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" }).format(d),
  };
}

function longDate(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

function slotLabel(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(iso));
}

function Step({ index, title, done, summary, open, onEdit, children }: { index: number; title: string; done: boolean; summary?: React.ReactNode; open: boolean; onEdit: () => void; children: React.ReactNode }) {
  return (
    <section className="border-b border-line last:border-0">
      <header className="flex items-center gap-3 py-3.5">
        <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${done && !open ? "bg-success text-white" : open ? "bg-brand text-white" : "bg-canvas text-ink-soft"}`}>
          {done && !open ? <Check className="size-3.5" aria-hidden /> : index}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className={`text-[15px] font-bold ${open || done ? "text-ink" : "text-ink-soft"}`}>{title}</h3>
          {done && !open && summary && <p className="truncate text-sm text-ink-soft">{summary}</p>}
        </div>
        {done && !open && (
          <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
            <Pencil className="size-3.5" aria-hidden /> {fr.common.edit}
          </button>
        )}
      </header>
      {open && <div className="pb-4">{children}</div>}
    </section>
  );
}

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full rounded-lg border px-3.5 py-3 text-left transition ${selected ? "border-brand bg-brand-softer ring-1 ring-brand" : "border-line bg-white hover:border-brand"}`}
    >
      {children}
    </button>
  );
}

export function BookingWidget({
  business,
  services,
  addons,
  staff,
  variantLabel,
  initialServiceId,
  initialDate,
  today,
  prefill,
  loggedIn,
  embedded = false,
}: {
  business: WidgetBusiness;
  services: Service[];
  addons: Addon[];
  staff: { id: string; name: string; title: string | null; service_ids: string[] }[];
  variantLabel: string | null;
  initialServiceId: string | null;
  initialDate: string | null;
  today: string;
  prefill: { name: string; email: string; phone: string; address: string };
  /** Module intégré sur le site du professionnel (iframe) : paiement ouvert dans un nouvel onglet. */
  embedded?: boolean;
  loggedIn: boolean;
}) {
  const [serviceId, setServiceId] = useState<string | null>(initialServiceId && services.some((s) => s.id === initialServiceId) ? initialServiceId : services.length === 1 ? (services[0]?.id ?? null) : null);
  const [variantKey, setVariantKey] = useState<string | null>(null);
  const [location, setLocation] = useState<LocationMode | null>(null);
  const [address, setAddress] = useState(prefill.address);
  const [distance, setDistance] = useState<{ label: string; distance_km: number; travel_fee_eur: number; out_of_zone: boolean } | null>(null);
  const [staffId, setStaffId] = useState<string | null | undefined>(undefined);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [addonsDone, setAddonsDone] = useState(false);
  const [seats, setSeats] = useState(1);
  const [seatsDone, setSeatsDone] = useState(false);
  const [weekStart, setWeekStart] = useState(initialDate && initialDate >= today ? initialDate : today);
  const [days, setDays] = useState<DayData[] | null>(null);
  const [nextAvailable, setNextAvailable] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [contact, setContact] = useState({ name: prefill.name, email: prefill.email, phone: prefill.phone, notes: "" });
  const [editing, setEditing] = useState<StepKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  const service = services.find((s) => s.id === serviceId) ?? null;
  const serviceModes = useMemo<LocationMode[]>(() => {
    if (!service) return business.modes;
    const own = service.modes.length ? service.modes.filter((m) => business.modes.includes(m)) : business.modes;
    return own.length ? own : business.modes;
  }, [service, business.modes]);
  const effectiveLocation: LocationMode | null = serviceModes.length === 1 ? (serviceModes[0] ?? null) : location;
  const eligibleStaff = useMemo(() => (service ? staff.filter((s) => s.service_ids.length === 0 || s.service_ids.includes(service.id)) : []), [service, staff]);
  const hasVariants = (service?.variants.length ?? 0) > 0;
  const groupService = (service?.capacity ?? 1) > 1 && !hasVariants;
  const chosenAddons = addons.filter((a) => addonIds.includes(a.id));

  const steps = useMemo(() => {
    const list: StepKey[] = ["service"];
    if (hasVariants) list.push("variant");
    if (serviceModes.length > 1 || effectiveLocation === "at_home") list.push("location");
    if (eligibleStaff.length > 1) list.push("staff");
    if (addons.length > 0) list.push("addons");
    if (groupService) list.push("seats");
    list.push("slot", "contact");
    return list;
  }, [hasVariants, serviceModes.length, effectiveLocation, eligibleStaff.length, addons.length, groupService]);

  const isDone = (k: StepKey): boolean => {
    switch (k) {
      case "service":
        return service !== null;
      case "variant":
        return !hasVariants || variantKey !== null;
      case "location":
        return effectiveLocation !== null && (effectiveLocation !== "at_home" || (distance !== null && !distance.out_of_zone));
      case "staff":
        return eligibleStaff.length <= 1 || staffId !== undefined;
      case "addons":
        return addons.length === 0 || addonsDone;
      case "seats":
        return !groupService || seatsDone;
      case "slot":
        return slot !== null;
      case "contact":
        return false;
    }
  };
  const firstOpen = steps.find((k) => !isDone(k)) ?? "contact";
  const openStep: StepKey = editing && steps.includes(editing) ? editing : firstOpen;
  const slotReady = steps.slice(0, steps.indexOf("slot")).every(isDone);

  const quote = useMemo(() => {
    if (!service || !effectiveLocation) return null;
    if (hasVariants && !variantKey) return null;
    if (effectiveLocation === "at_home" && !distance) return null;
    try {
      return computeQuote({
        service,
        variantKey,
        addons: chosenAddons,
        seats: groupService ? seats : 1,
        locationType: effectiveLocation,
        distanceKm: effectiveLocation === "at_home" ? (distance?.distance_km ?? null) : null,
        business: business.pricing,
      });
    } catch {
      return null;
    }
  }, [service, variantKey, chosenAddons, seats, groupService, effectiveLocation, distance, hasVariants, business.pricing]);

  const visibleDays = 5;
  useEffect(() => {
    if (!slotReady || !service || !effectiveLocation) return;
    const c = new AbortController();
    setDays(null);
    setNextAvailable(null);
    const params = new URLSearchParams({
      business: business.slug,
      service: service.id,
      location: effectiveLocation,
      start: weekStart,
      days: String(visibleDays),
      seats: String(groupService ? seats : 1),
    });
    if (variantKey) params.set("variant", variantKey);
    if (staffId) params.set("staff", staffId);
    if (addonIds.length) params.set("addons", addonIds.join(","));
    fetch(`/api/slots?${params}`, { signal: c.signal })
      .then((r) => r.json() as Promise<{ days?: DayData[]; next_available?: string | null }>)
      .then((d) => {
        setDays(d.days ?? []);
        setNextAvailable(d.next_available ?? null);
      })
      .catch(() => undefined);
    return () => c.abort();
  }, [slotReady, service, effectiveLocation, weekStart, variantKey, staffId, addonIds, seats, groupService, business.slug]);

  function resetAfter(k: StepKey) {
    const idx = steps.indexOf(k);
    if (idx < steps.indexOf("slot")) setSlot(null);
    setEditing(null);
  }

  async function checkAddress() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/distance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ business: business.slug, address }) });
      const data = (await res.json()) as { label: string; distance_km: number; travel_fee_eur: number; out_of_zone: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "address_not_found");
      setDistance(data);
      if (!data.out_of_zone) resetAfter("location");
    } catch (err) {
      setDistance(null);
      setError(ERRORS[err instanceof Error ? err.message : ""] ?? t.addressNotFound);
    } finally {
      setBusy(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!service || !slot || !effectiveLocation) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business: business.slug,
          service_id: service.id,
          variant_key: variantKey,
          addon_ids: addonIds,
          seats: groupService ? seats : 1,
          staff_id: staffId ?? null,
          location_type: effectiveLocation,
          client_address: effectiveLocation === "at_home" ? (distance?.label ?? address) : "",
          start_at: slot.startAt,
          client_name: contact.name,
          client_email: contact.email,
          client_phone: contact.phone,
          client_notes: contact.notes,
          source: readSource(business.slug),
        }),
      });
      const data = (await res.json()) as { payment_url?: string; error?: string };
      if (!res.ok) {
        if (data.error === "slot_taken") {
          setSlot(null);
          setDays((prev) => prev?.map((d) => ({ ...d, slots: d.slots.filter((s) => s.startAt !== slot.startAt) })) ?? null);
        }
        throw new Error(ERRORS[data.error ?? ""] ?? fr.common.error);
      }
      if (data.payment_url) {
        if (embedded) {
          setPaymentUrl(data.payment_url);
          return;
        }
        window.location.href = data.payment_url;
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.common.error);
    } finally {
      setBusy(false);
    }
  }

  if (paymentUrl && slot) {
    return (
      <div className="p-5 text-center">
        <h3 className="text-xl font-bold">Acompte à régler</h3>
        <p className="mt-1 font-semibold capitalize text-brand">{slotLabel(slot.startAt)}</p>
        <p className="mt-2 text-sm text-ink-soft">Votre créneau est réservé quelques minutes, le temps de régler l&apos;acompte sur la page de paiement sécurisée.</p>
        <a href={paymentUrl} target="_blank" rel="noopener" className="btn-primary mt-5 w-full">
          Payer l&apos;acompte
        </a>
      </div>
    );
  }

  if (done && slot) {
    return (
      <div className="p-5 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-success text-white">
          <Check className="size-7" aria-hidden />
        </span>
        <h3 className="mt-4 text-xl font-bold">{t.successTitle}</h3>
        <p className="mt-1 font-semibold capitalize text-brand">{slotLabel(slot.startAt)}</p>
        <p className="mt-2 text-sm text-ink-soft">{t.successText}</p>
        <Link href={loggedIn ? "/compte" : `/login?next=/compte`} target={embedded ? "_blank" : undefined} className="btn-primary mt-5 w-full">
          {t.seeMyAppointments}
        </Link>
      </div>
    );
  }

  const n = (k: StepKey) => steps.indexOf(k) + 1;
  const priceOf = (s: Service) => {
    const cents = startingPriceCents(s);
    const label = cents === 0 ? fr.common.free : formatEur(cents);
    return s.variants.length ? `${fr.common.from} ${label}` : label;
  };

  return (
    <div className="px-4 sm:px-5">
      {steps.includes("service") && (
        <Step index={n("service")} title={t.stepService} done={isDone("service")} open={openStep === "service"} onEdit={() => setEditing("service")} summary={service ? `${service.name} · ${priceOf(service)}` : null}>
          <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {services.map((s) => (
              <Choice
                key={s.id}
                selected={serviceId === s.id}
                onClick={() => {
                  setServiceId(s.id);
                  setVariantKey(null);
                  setLocation(null);
                  setStaffId(undefined);
                  setSeats(1);
                  setSeatsDone(false);
                  resetAfter("service");
                }}
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block font-semibold">{s.name}</span>
                    {s.description && <span className="mt-0.5 line-clamp-2 block text-sm text-ink-soft">{s.description}</span>}
                    <span className="mt-1 block text-xs text-ink-soft">
                      {formatDuration(s.duration_minutes)}
                      {s.capacity > 1 && s.variants.length === 0 ? ` · ${s.capacity} places` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 font-bold">{priceOf(s)}</span>
                </span>
              </Choice>
            ))}
          </div>
        </Step>
      )}

      {steps.includes("variant") && service && (
        <Step
          index={n("variant")}
          title={variantLabel ?? t.stepVariant}
          done={isDone("variant")}
          open={openStep === "variant"}
          onEdit={() => setEditing("variant")}
          summary={service.variants.find((v) => v.key === variantKey)?.label}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            {service.variants.map((v) => (
              <Choice
                key={v.key}
                selected={variantKey === v.key}
                onClick={() => {
                  setVariantKey(v.key);
                  resetAfter("variant");
                }}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{v.label}</span>
                  <span className="text-sm font-bold">{Number(v.price_eur) === 0 ? fr.common.free : formatEur(Math.round(Number(v.price_eur) * 100))}</span>
                </span>
                <span className="text-xs text-ink-soft">{formatDuration(v.duration_minutes)}</span>
              </Choice>
            ))}
          </div>
        </Step>
      )}

      {steps.includes("location") && (
        <Step
          index={n("location")}
          title={t.stepLocation}
          done={isDone("location")}
          open={openStep === "location"}
          onEdit={() => setEditing("location")}
          summary={effectiveLocation ? `${fr.modes[effectiveLocation]}${effectiveLocation === "at_home" && distance ? ` · ${distance.label}` : ""}` : null}
        >
          {serviceModes.length > 1 && (
            <div className="grid grid-cols-3 gap-2">
              {serviceModes.map((m) => {
                const Icon = MODE_ICON[m];
                return (
                  <Choice
                    key={m}
                    selected={effectiveLocation === m}
                    onClick={() => {
                      setLocation(m);
                      setError(null);
                      if (m !== "at_home") resetAfter("location");
                    }}
                  >
                    <Icon className="mb-1 size-5 text-brand" aria-hidden />
                    <span className="block text-sm font-semibold">{fr.modes[m]}</span>
                  </Choice>
                );
              })}
            </div>
          )}
          {effectiveLocation === "on_site" && business.address && (
            <p className="mt-3 flex items-start gap-2 text-sm text-ink-soft">
              <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden /> {business.address}
            </p>
          )}
          {effectiveLocation === "at_home" && (
            <div className="mt-3 space-y-2">
              <label className="label" htmlFor="rdv-address">
                {t.yourAddress}
              </label>
              <div className="flex gap-2">
                <input
                  id="rdv-address"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setDistance(null);
                  }}
                  autoComplete="street-address"
                  className="input"
                />
                <button type="button" onClick={checkAddress} disabled={busy || address.trim().length < 5} className="btn-primary shrink-0">
                  {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : t.checkAddress}
                </button>
              </div>
              {distance && (
                <p className={`rounded-lg px-3 py-2 text-sm ${distance.out_of_zone ? "bg-red-50 text-danger" : "bg-brand-softer text-brand"}`}>
                  {distance.out_of_zone
                    ? t.outOfZone
                    : `${distance.distance_km} km · ${distance.travel_fee_eur > 0 ? `${t.travelFee} : ${formatEur(Math.round(distance.travel_fee_eur * 100))}` : t.travelFree}`}
                </p>
              )}
              {error && <p className="text-sm text-danger">{error}</p>}
            </div>
          )}
        </Step>
      )}

      {steps.includes("staff") && (
        <Step
          index={n("staff")}
          title={t.stepStaff}
          done={isDone("staff")}
          open={openStep === "staff"}
          onEdit={() => setEditing("staff")}
          summary={staffId ? eligibleStaff.find((s) => s.id === staffId)?.name : t.anyStaff}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <Choice
              selected={staffId === null}
              onClick={() => {
                setStaffId(null);
                resetAfter("staff");
              }}
            >
              <span className="flex items-center gap-2.5">
                <Users className="size-5 text-brand" aria-hidden />
                <span>
                  <span className="block font-semibold">{t.anyStaff}</span>
                  <span className="text-xs text-ink-soft">{t.anyStaffHint}</span>
                </span>
              </span>
            </Choice>
            {eligibleStaff.map((s) => (
              <Choice
                key={s.id}
                selected={staffId === s.id}
                onClick={() => {
                  setStaffId(s.id);
                  resetAfter("staff");
                }}
              >
                <span className="flex items-center gap-2.5">
                  <UserRound className="size-5 text-brand" aria-hidden />
                  <span>
                    <span className="block font-semibold">{s.name}</span>
                    {s.title && <span className="text-xs text-ink-soft">{s.title}</span>}
                  </span>
                </span>
              </Choice>
            ))}
          </div>
        </Step>
      )}

      {steps.includes("addons") && (
        <Step
          index={n("addons")}
          title={t.stepAddons}
          done={isDone("addons")}
          open={openStep === "addons"}
          onEdit={() => setEditing("addons")}
          summary={chosenAddons.length ? chosenAddons.map((a) => a.name).join(", ") : "—"}
        >
          <div className="space-y-2">
            {addons.map((a) => {
              const selected = addonIds.includes(a.id);
              return (
                <Choice key={a.id} selected={selected} onClick={() => setAddonIds((ids) => (selected ? ids.filter((i) => i !== a.id) : [...ids, a.id]))}>
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2.5">
                      <span className={`grid size-5 place-items-center rounded border ${selected ? "border-brand bg-brand text-white" : "border-line"}`}>{selected && <Check className="size-3.5" aria-hidden />}</span>
                      <span className="font-medium">{a.name}</span>
                    </span>
                    <span className="text-sm font-bold">+{formatEur(Math.round(Number(a.price_eur) * 100))}</span>
                  </span>
                </Choice>
              );
            })}
          </div>
          <button
            type="button"
            className="btn-primary mt-3 w-full"
            onClick={() => {
              setAddonsDone(true);
              resetAfter("addons");
            }}
          >
            {fr.common.next}
          </button>
        </Step>
      )}

      {steps.includes("seats") && service && (
        <Step index={n("seats")} title={t.stepSeats} done={isDone("seats")} open={openStep === "seats"} onEdit={() => setEditing("seats")} summary={String(seats)}>
          <div className="flex items-center justify-center gap-5">
            <button type="button" className="btn-secondary size-11 rounded-full p-0" onClick={() => setSeats((s) => Math.max(1, s - 1))} aria-label="-">
              <Minus className="size-4" aria-hidden />
            </button>
            <span className="w-10 text-center text-2xl font-bold">{seats}</span>
            <button type="button" className="btn-secondary size-11 rounded-full p-0" onClick={() => setSeats((s) => Math.min(service.capacity, 10, s + 1))} aria-label="+">
              <Plus className="size-4" aria-hidden />
            </button>
          </div>
          <button
            type="button"
            className="btn-primary mt-4 w-full"
            onClick={() => {
              setSeatsDone(true);
              resetAfter("seats");
            }}
          >
            {fr.common.next}
          </button>
        </Step>
      )}

      <Step index={n("slot")} title={t.stepSlot} done={isDone("slot")} open={openStep === "slot"} onEdit={() => setEditing("slot")} summary={slot ? <span className="capitalize">{slotLabel(slot.startAt)}</span> : null}>
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => setWeekStart((w) => (addDays(w, -visibleDays) < today ? today : addDays(w, -visibleDays)))} disabled={weekStart <= today} className="btn-ghost size-9 p-0" aria-label={fr.search.previous}>
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <div className="grid flex-1 grid-cols-5 gap-1.5 text-center">
            {Array.from({ length: visibleDays }, (_, i) => addDays(weekStart, i)).map((d) => {
              const l = dayLabel(d);
              return (
                <p key={d} className="text-xs leading-tight">
                  <span className="block font-bold capitalize">{l.weekday}</span>
                  <span className="text-ink-soft">{l.day}</span>
                </p>
              );
            })}
          </div>
          <button type="button" onClick={() => setWeekStart((w) => addDays(w, visibleDays))} className="btn-ghost size-9 p-0" aria-label={fr.search.nextPage}>
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </div>
        <div className="mt-2 px-9">
          {days === null ? (
            <p className="flex items-center justify-center gap-2 py-8 text-sm text-ink-soft">
              <Loader2 className="size-4 animate-spin" aria-hidden /> {fr.common.loading}
            </p>
          ) : days.every((d) => d.slots.length === 0) ? (
            <div className="py-6 text-center">
              {nextAvailable ? (
                <button type="button" onClick={() => setWeekStart(nextAvailable)} className="btn-secondary border-brand text-brand">
                  {format(t.jumpTo, { date: longDate(nextAvailable) })}
                </button>
              ) : (
                <p className="text-sm text-ink-soft">{t.noSlotsAtAll}</p>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-5 gap-1.5">
                {days.map((d) => (
                  <div key={d.date} className="space-y-1.5">
                    {(expanded ? d.slots : d.slots.slice(0, 6)).map((s) => (
                      <button
                        key={s.startAt}
                        type="button"
                        onClick={() => {
                          setSlot(s);
                          setEditing(null);
                        }}
                        className={`${slot?.startAt === s.startAt ? "slot bg-brand text-white" : "slot"} flex-col px-0.5 py-1.5 text-xs`}
                      >
                        {s.time}
                        {s.remaining !== null && <span className="block text-[10px] font-medium opacity-75">{format(t.placesLeft, { n: s.remaining })}</span>}
                      </button>
                    ))}
                    {d.slots.length === 0 && <span className="block py-2 text-center text-xs text-slate-300">—</span>}
                  </div>
                ))}
              </div>
              {!expanded && days.some((d) => d.slots.length > 6) && (
                <button type="button" onClick={() => setExpanded(true)} className="mt-3 w-full text-center text-sm font-semibold text-brand hover:underline">
                  {fr.search.moreSlots}
                </button>
              )}
            </>
          )}
          {days !== null && service && <Waitlist businessSlug={business.slug} serviceId={service.id} from={weekStart} prefill={{ name: prefill.name, email: prefill.email }} />}
        </div>
      </Step>

      <Step index={n("contact")} title={t.stepContact} done={false} open={openStep === "contact" && slot !== null} onEdit={() => setEditing("contact")}>
        <form onSubmit={submit} className="space-y-3">
          <input required minLength={2} maxLength={80} placeholder={t.name} autoComplete="name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} className="input" />
          <input required type="email" placeholder={t.email} autoComplete="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} className="input" />
          <input required type="tel" minLength={6} placeholder={t.phone} autoComplete="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} className="input" />
          <textarea maxLength={500} rows={2} placeholder={t.notes} value={contact.notes} onChange={(e) => setContact({ ...contact, notes: e.target.value })} className="input resize-none" />
          {!loggedIn && (
            <p className="text-xs text-ink-soft">
              <Link href={`/login?next=${encodeURIComponent(business.path)}`} className="font-semibold text-brand hover:underline">
                {fr.common.login}
              </Link>{" "}
              — {t.loginHint}
            </p>
          )}

          {quote && service && (
            <div className="space-y-1.5 rounded-lg bg-canvas p-3.5 text-sm">
              <div className="flex justify-between gap-3">
                <span>
                  {service.name}
                  {quote.variant ? ` · ${quote.variant.label}` : ""}
                  {quote.seats > 1 ? ` × ${quote.seats}` : ""}
                </span>
                <span>{formatEur(quote.unitPriceCents * quote.seats)}</span>
              </div>
              {chosenAddons.map((a) => (
                <div key={a.id} className="flex justify-between text-ink-soft">
                  <span>{a.name}</span>
                  <span>{formatEur(Math.round(Number(a.price_eur) * 100) * quote.seats)}</span>
                </div>
              ))}
              {effectiveLocation === "at_home" && (
                <div className="flex justify-between text-ink-soft">
                  <span>{t.travelFee}</span>
                  <span>{quote.travelFeeCents > 0 ? formatEur(quote.travelFeeCents) : t.travelFree}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-line pt-2 text-base font-bold">
                <span>{t.total}</span>
                <span>{quote.totalCents === 0 ? fr.common.free : formatEur(quote.totalCents)}</span>
              </div>
              <div className="flex justify-between font-semibold text-brand">
                <span>{quote.depositCents > 0 ? t.deposit : t.payOnSite}</span>
                {quote.depositCents > 0 && <span>{formatEur(quote.depositCents)}</span>}
              </div>
              <p className="text-xs text-ink-soft">{formatDuration(service ? servicePrice(service, variantKey).duration_minutes : 0)}</p>
            </div>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
          <button type="submit" disabled={busy || !slot} className="btn-primary w-full py-3.5 text-base">
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {quote && quote.depositCents > 0 ? t.payDeposit : t.confirm}
          </button>
          <p className="text-center text-xs text-ink-soft">{t.acceptTerms}</p>
        </form>
      </Step>
    </div>
  );
}
