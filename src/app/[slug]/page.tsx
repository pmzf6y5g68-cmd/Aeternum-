import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircle2, MapPin, Phone } from "lucide-react";
import { fr } from "@/i18n/fr";
import { bookingWindow, loadCatalog, loadPublicStudio } from "@/lib/booking-engine";
import { BookingFlow } from "./booking-flow";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const studio = await loadPublicStudio(slug);
  if (!studio) return { title: fr.booking.notFound };
  return {
    title: `Réserver chez ${studio.name}`,
    description: `Réservez votre prestation de detailing chez ${studio.name}${studio.city ? ` à ${studio.city}` : ""} : prix immédiat et créneaux libres.`,
  };
}

export default async function StudioBookingPage({ params, searchParams }: { params: Params; searchParams: Promise<{ booking?: string }> }) {
  const [{ slug }, { booking }] = await Promise.all([params, searchParams]);
  const studio = await loadPublicStudio(slug);
  if (!studio) notFound();
  const { services, addons } = await loadCatalog(studio);
  const window = bookingWindow();

  return (
    <main className="min-h-dvh bg-muted px-4 py-8">
      <div className="mx-auto w-full max-w-xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">{studio.name}</h1>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
            {studio.city && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden /> {studio.city}
              </span>
            )}
            {studio.phone && (
              <a href={`tel:${studio.phone}`} className="inline-flex items-center gap-1 text-accent">
                <Phone className="size-3.5" aria-hidden /> {studio.phone}
              </a>
            )}
            <span>{fr.serviceModes[studio.service_mode]}</span>
          </div>
        </header>

        {booking === "success" ? (
          <div className="card text-center">
            <CheckCircle2 className="mx-auto size-12 text-accent" aria-hidden />
            <h2 className="mt-3 text-xl font-bold">{fr.booking.successTitle}</h2>
            <p className="mt-2 text-sm text-slate-600">{fr.booking.depositSuccessText}</p>
          </div>
        ) : services.length === 0 ? (
          <p className="card text-sm text-slate-600">{fr.booking.noSlots}</p>
        ) : (
          <div className="card p-5 sm:p-7">
            <BookingFlow studio={studio} services={services} addons={addons} minDate={window.min} maxDate={window.max} />
          </div>
        )}
        <p className="mt-6 text-center text-xs text-slate-400">
          Réservation propulsée par <a href="/" className="underline">Slotly</a>
        </p>
      </div>
    </main>
  );
}
