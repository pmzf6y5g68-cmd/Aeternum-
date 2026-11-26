import { SiteHeader } from "@/components/site-header";

/** Squelette de la fiche : bandeau, prestations et module de réservation à leur place définitive. */
export default function BusinessLoading() {
  return (
    <>
      <SiteHeader variant="white" />
      <div className="bg-brand">
        <div className="mx-auto flex max-w-6xl items-end gap-4 px-4 py-8">
          <div className="size-20 shrink-0 rounded-2xl bg-white/15" />
          <div className="flex-1 space-y-2.5">
            <div className="h-7 w-64 max-w-full rounded-lg bg-white/20" />
            <div className="h-4 w-32 rounded-lg bg-white/15" />
          </div>
        </div>
      </div>
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_24rem]" aria-busy="true" aria-label="Chargement de l'établissement">
        <div className="space-y-4 lg:order-1">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="card space-y-3">
              <div className="skeleton h-5 w-40" />
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-5/6" />
            </div>
          ))}
        </div>
        <div className="card space-y-3 lg:order-2">
          <div className="skeleton h-6 w-1/2" />
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton h-14 w-full" />
          ))}
        </div>
      </main>
    </>
  );
}
