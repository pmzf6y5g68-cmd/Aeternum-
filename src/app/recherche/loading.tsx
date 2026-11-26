import { SiteHeader } from "@/components/site-header";

/** Squelette de la recherche : la mise en page apparaît tout de suite, les résultats se remplissent. */
export default function SearchLoading() {
  return (
    <>
      <SiteHeader variant="white" />
      <main className="mx-auto max-w-6xl px-4 py-5" aria-busy="true" aria-label="Chargement des résultats">
        <div className="flex gap-2 overflow-hidden">
          {[88, 120, 96, 110, 80].map((w, i) => (
            <div key={i} className="skeleton h-9 shrink-0 rounded-full" style={{ width: w }} />
          ))}
        </div>
        <div className="skeleton mt-5 h-6 w-64" />
        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_26rem]">
          <ul className="space-y-3">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="card flex gap-4">
                <div className="skeleton size-20 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2.5">
                  <div className="skeleton h-5 w-1/2" />
                  <div className="skeleton h-4 w-1/3" />
                  <div className="flex gap-2 pt-1">
                    {Array.from({ length: 4 }, (_, j) => (
                      <div key={j} className="skeleton h-9 w-16" />
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="skeleton hidden h-[70vh] rounded-2xl lg:block" />
        </div>
      </main>
    </>
  );
}
