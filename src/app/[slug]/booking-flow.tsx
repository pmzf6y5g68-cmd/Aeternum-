"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, Check, Home, Loader2, MapPin } from "lucide-react";
import { fr } from "@/i18n/fr";
import { VEHICLE_SIZES, computeQuote, formatEur, servicePriceForSize, type VehicleSize } from "@/lib/domain/pricing";
import type { Addon, PublicStudio, Service } from "@/lib/supabase/types";

const t = fr.booking;

interface Slot {
  time: string;
  startAt: string;
}

interface DistanceInfo {
  label: string;
  distance_km: number;
  travel_fee_eur: number;
  out_of_zone: boolean;
}

const ERROR_MESSAGES: Record<string, string> = {
  slot_taken: t.slotTaken,
  quota_exceeded: t.quotaExceeded,
  out_of_zone: t.outOfZone,
};

function Stepper({ step, labels }: { step: number; labels: readonly string[] }) {
  return (
    <ol className="mb-6 grid grid-cols-4 gap-2">
      {labels.map((label, i) => (
        <li key={label} className="text-center">
          <div className={`mx-auto h-1.5 rounded-full ${i <= step ? "bg-accent" : "bg-slate-200"}`} />
          <span className={`mt-1.5 block text-xs ${i === step ? "font-semibold text-ink" : "text-slate-500"}`}>{label}</span>
        </li>
      ))}
    </ol>
  );
}

function OptionCard({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`w-full rounded-2xl border p-4 text-left transition ${selected ? "border-accent bg-accent-soft/50 ring-2 ring-accent" : "border-slate-200 bg-white hover:border-slate-300"}`}
    >
      {children}
    </button>
  );
}

export function BookingFlow({
  studio,
  services,
  addons,
  minDate,
  maxDate,
}: {
  studio: PublicStudio;
  services: Service[];
  addons: Addon[];
  minDate: string;
  maxDate: string;
}) {
  const fixedLocation = studio.service_mode === "both" ? null : studio.service_mode;
  const [step, setStep] = useState(fixedLocation === "workshop" ? 1 : 0);
  const [location, setLocation] = useState<"workshop" | "mobile">(fixedLocation ?? "workshop");
  const [address, setAddress] = useState("");
  const [distance, setDistance] = useState<DistanceInfo | null>(null);
  const [size, setSize] = useState<VehicleSize>("berline");
  const [vehicleModel, setVehicleModel] = useState("");
  const [serviceId, setServiceId] = useState<string | null>(services[0]?.id ?? null);
  const [addonIds, setAddonIds] = useState<string[]>([]);
  const [date, setDate] = useState(minDate);
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const service = services.find((s) => s.id === serviceId) ?? null;
  const chosenAddons = addons.filter((a) => addonIds.includes(a.id));

  const quote = useMemo(() => {
    if (!service) return null;
    if (location === "mobile" && !distance) return null;
    try {
      return computeQuote({
        service,
        addons: chosenAddons,
        size,
        locationType: location,
        distanceKm: location === "mobile" ? (distance?.distance_km ?? null) : null,
        studio: {
          free_radius_km: Number(studio.free_radius_km),
          max_radius_km: Number(studio.max_radius_km),
          price_per_extra_km: Number(studio.price_per_extra_km),
          travel_buffer_minutes: Number(studio.travel_buffer_minutes),
          deposit_enabled: studio.deposit_enabled,
          deposit_percent: Number(studio.deposit_percent),
          stripe_connect_onboarded: studio.stripe_connect_onboarded,
        },
      });
    } catch {
      return null;
    }
  }, [service, chosenAddons, size, location, distance, studio]);

  useEffect(() => {
    if (step !== 3 || !service) return;
    const controller = new AbortController();
    setSlots(null);
    setSlot(null);
    const params = new URLSearchParams({ slug: studio.slug, date, service_id: service.id, size, location, addons: addonIds.join(",") });
    fetch(`/api/availability?${params}`, { signal: controller.signal })
      .then((r) => r.json() as Promise<{ slots?: Slot[] }>)
      .then((data) => setSlots(data.slots ?? []))
      .catch(() => undefined);
    return () => controller.abort();
  }, [step, date, service, size, location, addonIds, studio.slug]);

  async function checkAddress() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/distance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: studio.slug, address }),
      });
      const data = (await res.json()) as DistanceInfo & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "error");
      setDistance(data);
    } catch {
      setDistance(null);
      setError(fr.onboarding.geocodeFailed);
    } finally {
      setLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!service || !slot) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: studio.slug,
          service_id: service.id,
          addon_ids: addonIds,
          size,
          vehicle_model: vehicleModel,
          location_type: location,
          client_address: location === "mobile" ? (distance?.label ?? address) : "",
          start_at: slot.startAt,
          client_name: contact.name,
          client_email: contact.email,
          client_phone: contact.phone,
        }),
      });
      const data = (await res.json()) as { checkout_url?: string; error?: string };
      if (!res.ok) {
        if (data.error === "slot_taken") {
          setSlot(null);
          setSlots((prev) => prev?.filter((s) => s.startAt !== slot.startAt) ?? null);
        }
        throw new Error(ERROR_MESSAGES[data.error ?? ""] ?? fr.common.error);
      }
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : fr.common.error);
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="card text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-white">
          <Check className="size-6" aria-hidden />
        </span>
        <h2 className="mt-4 text-xl font-bold">{t.successTitle}</h2>
        <p className="mt-2 text-sm text-slate-600">{t.successText}</p>
      </div>
    );
  }

  const canBack = step > (fixedLocation === "workshop" ? 1 : 0);
  const goNextFromServices = () => setStep(addons.length > 0 ? 2 : 3);
  const goBack = () => setStep((s) => (s === 3 && addons.length === 0 ? 1 : s - 1));

  return (
    <div>
      <Stepper step={step} labels={t.steps} />

      {canBack && (
        <button type="button" onClick={goBack} className="btn-ghost -ml-2 mb-3 px-2 text-sm">
          <ArrowLeft className="size-4" aria-hidden /> {fr.common.back}
        </button>
      )}

      {step === 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t.whereTitle}</h2>
          {fixedLocation === null && (
            <div className="grid grid-cols-2 gap-3">
              <OptionCard selected={location === "workshop"} onClick={() => setLocation("workshop")}>
                <Building2 className="size-5 text-accent" aria-hidden />
                <p className="mt-2 font-semibold">{t.atWorkshop}</p>
                {studio.city && <p className="text-xs text-slate-500">{studio.city}</p>}
              </OptionCard>
              <OptionCard selected={location === "mobile"} onClick={() => setLocation("mobile")}>
                <Home className="size-5 text-accent" aria-hidden />
                <p className="mt-2 font-semibold">{t.atHome}</p>
                <p className="text-xs text-slate-500">
                  {t.travelFree} ≤ {Number(studio.free_radius_km)} km
                </p>
              </OptionCard>
            </div>
          )}
          {location === "mobile" && (
            <div className="space-y-2">
              <label className="label" htmlFor="address">
                {t.yourAddress}
              </label>
              <div className="flex gap-2">
                <input
                  id="address"
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setDistance(null);
                  }}
                  autoComplete="street-address"
                  className="input"
                />
                <button type="button" onClick={checkAddress} disabled={loading || address.trim().length < 5} className="btn-secondary shrink-0">
                  {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MapPin className="size-4" aria-hidden />}
                  {t.checkAddress}
                </button>
              </div>
              {distance && (
                <p className={`rounded-xl px-3.5 py-2.5 text-sm ${distance.out_of_zone ? "bg-red-50 text-red-700" : "bg-accent-soft/60 text-accent-dark"}`}>
                  {distance.out_of_zone
                    ? t.outOfZone
                    : `${distance.label} · ${distance.distance_km} km · ${
                        distance.travel_fee_eur > 0 ? `${t.travelFee} : ${formatEur(Math.round(distance.travel_fee_eur * 100))}` : t.travelFree
                      }`}
                </p>
              )}
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            className="btn-primary w-full py-3"
            disabled={location === "mobile" && (!distance || distance.out_of_zone)}
            onClick={() => {
              setError(null);
              setStep(1);
            }}
          >
            {fr.common.next}
          </button>
        </section>
      )}

      {step === 1 && (
        <section className="space-y-5">
          <div>
            <h2 className="mb-3 text-lg font-semibold">{t.sizeTitle}</h2>
            <div className="grid grid-cols-2 gap-2">
              {VEHICLE_SIZES.map((s) => (
                <OptionCard key={s} selected={size === s} onClick={() => setSize(s)}>
                  <span className="text-sm font-semibold">{fr.vehicleSizes[s]}</span>
                </OptionCard>
              ))}
            </div>
            <input value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} placeholder={t.vehicleModel} className="input mt-3" maxLength={80} />
          </div>
          <div>
            <h2 className="mb-3 text-lg font-semibold">{t.serviceTitle}</h2>
            <div className="space-y-2">
              {services.map((s) => {
                const p = servicePriceForSize(s, size);
                return (
                  <OptionCard key={s.id} selected={serviceId === s.id} onClick={() => setServiceId(s.id)}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{s.name}</p>
                        {s.description && <p className="mt-0.5 text-sm text-slate-600">{s.description}</p>}
                        <p className="mt-1 text-xs text-slate-500">
                          {p.duration_minutes} {fr.common.minutes}
                        </p>
                      </div>
                      <p className="shrink-0 font-bold">{formatEur(Math.round(p.price_eur * 100))}</p>
                    </div>
                  </OptionCard>
                );
              })}
            </div>
          </div>
          <button type="button" className="btn-primary w-full py-3" disabled={!service} onClick={goNextFromServices}>
            {fr.common.next}
          </button>
        </section>
      )}

      {step === 2 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold">{t.addonsTitle}</h2>
          <div className="space-y-2">
            {addons.map((a) => {
              const selected = addonIds.includes(a.id);
              return (
                <OptionCard key={a.id} selected={selected} onClick={() => setAddonIds((ids) => (selected ? ids.filter((id) => id !== a.id) : [...ids, a.id]))}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className={`grid size-5 place-items-center rounded-md border ${selected ? "border-accent bg-accent text-white" : "border-slate-300"}`}>
                        {selected && <Check className="size-3.5" aria-hidden />}
                      </span>
                      <span className="font-medium">{a.name}</span>
                    </div>
                    <span className="font-semibold">+{formatEur(Math.round(Number(a.price_eur) * 100))}</span>
                  </div>
                </OptionCard>
              );
            })}
          </div>
          <button type="button" className="btn-primary w-full py-3" onClick={() => setStep(3)}>
            {fr.common.next}
          </button>
        </section>
      )}

      {step === 3 && (
        <form onSubmit={submit} className="space-y-5">
          <div>
            <h2 className="mb-3 text-lg font-semibold">{t.slotTitle}</h2>
            <label className="label" htmlFor="date">
              {t.date}
            </label>
            <input id="date" type="date" value={date} min={minDate} max={maxDate} onChange={(e) => e.target.value && setDate(e.target.value)} className="input" />
            <div className="mt-3">
              {slots === null ? (
                <p className="flex items-center gap-2 text-sm text-slate-500">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> {fr.common.loading}
                </p>
              ) : slots.length === 0 ? (
                <p className="text-sm text-slate-500">{t.noSlots}</p>
              ) : (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                  {slots.map((s) => (
                    <button
                      key={s.startAt}
                      type="button"
                      onClick={() => setSlot(s)}
                      className={`rounded-xl border py-2 text-sm font-semibold ${slot?.startAt === s.startAt ? "border-accent bg-accent text-white" : "border-slate-200 hover:border-accent"}`}
                    >
                      {s.time}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <fieldset className="space-y-3">
            <legend className="mb-1 text-lg font-semibold">{t.contactTitle}</legend>
            <input required minLength={2} placeholder={t.name} autoComplete="name" value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} className="input" />
            <input required type="email" placeholder={t.email} autoComplete="email" value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} className="input" />
            <input required type="tel" minLength={6} placeholder={t.phone} autoComplete="tel" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} className="input" />
          </fieldset>

          {quote && (
            <div className="space-y-1.5 rounded-2xl bg-muted p-4 text-sm">
              <div className="flex justify-between">
                <span>{service?.name}</span>
                <span>{formatEur(quote.servicePriceCents)}</span>
              </div>
              {chosenAddons.map((a) => (
                <div key={a.id} className="flex justify-between text-slate-600">
                  <span>{a.name}</span>
                  <span>{formatEur(Math.round(Number(a.price_eur) * 100))}</span>
                </div>
              ))}
              {location === "mobile" && (
                <div className="flex justify-between text-slate-600">
                  <span>{t.travelFee}</span>
                  <span>{quote.travelFeeCents > 0 ? formatEur(quote.travelFeeCents) : t.travelFree}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold">
                <span>{t.total}</span>
                <span>{formatEur(quote.totalCents)}</span>
              </div>
              <div className="flex justify-between font-semibold text-accent">
                <span>{quote.depositCents > 0 ? t.deposit : t.payOnSite}</span>
                {quote.depositCents > 0 && <span>{formatEur(quote.depositCents)}</span>}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={!slot || loading} className="btn-primary w-full py-3.5 text-base">
            {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {quote && quote.depositCents > 0 ? t.payDeposit : t.confirm}
          </button>
        </form>
      )}
    </div>
  );
}
