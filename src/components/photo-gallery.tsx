"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

/**
 * Galerie de fiche : mosaïque sur ordinateur (1 grande + 4 petites), défilement aimanté au doigt sur mobile,
 * plein écran au clic avec flèches, balayage et clavier.
 */
export function PhotoGallery({ name, urls }: { name: string; urls: string[] }) {
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % urls.length));
      if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : (i - 1 + urls.length) % urls.length));
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, urls.length]);

  const alt = (i: number) => `${name}, photo ${i + 1} sur ${urls.length}`;
  return (
    <section aria-label="Photos">
      {/* Mobile : bandeau qui défile au doigt, une photo à la fois. */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 [scrollbar-width:none] md:hidden">
        {urls.map((u, i) => (
          <button key={u} type="button" onClick={() => setOpen(i)} className="relative w-[85%] shrink-0 snap-center overflow-hidden rounded-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={alt(i)} loading={i === 0 ? "eager" : "lazy"} className="aspect-[4/3] w-full object-cover" />
            <span className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white tabular-nums">
              {i + 1}/{urls.length}
            </span>
          </button>
        ))}
      </div>
      {/* Ordinateur : mosaïque. */}
      <div className={`hidden gap-2 overflow-hidden rounded-2xl md:grid ${urls.length >= 3 ? "h-80 grid-cols-4 grid-rows-2" : "h-72 grid-cols-2"}`}>
        {urls.slice(0, 5).map((u, i) => (
          <button
            key={u}
            type="button"
            onClick={() => setOpen(i)}
            className={`relative overflow-hidden ${urls.length >= 3 && i === 0 ? "col-span-2 row-span-2" : ""} ${urls.length === 3 && i > 0 ? "col-span-2" : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt={alt(i)} loading={i === 0 ? "eager" : "lazy"} className="size-full object-cover transition duration-300 hover:scale-[1.03]" />
            {i === 4 && urls.length > 5 && <span className="absolute inset-0 grid place-items-center bg-black/45 text-lg font-bold text-white">+{urls.length - 5}</span>}
          </button>
        ))}
      </div>

      {open !== null && (
        <div role="dialog" aria-modal="true" aria-label={`Photos de ${name}`} className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90" onClick={() => setOpen(null)}>
          <button type="button" onClick={() => setOpen(null)} className="absolute right-4 top-[max(1rem,env(safe-area-inset-top))] grid size-11 place-items-center rounded-full bg-white/15 text-white" aria-label="Fermer">
            <X className="size-6" aria-hidden />
          </button>
          {urls.length > 1 && (
            <button type="button" onClick={(e) => { e.stopPropagation(); setOpen((open - 1 + urls.length) % urls.length); }} className="absolute left-3 grid size-11 place-items-center rounded-full bg-white/15 text-white" aria-label="Photo précédente">
              <ChevronLeft className="size-6" aria-hidden />
            </button>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urls[open]}
            alt={alt(open)}
            className="sheet-in max-h-[85dvh] max-w-[92vw] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
            onTouchStart={(e) => ((e.currentTarget as HTMLImageElement).dataset.x = String(e.touches[0]?.clientX ?? 0))}
            onTouchEnd={(e) => {
              const dx = (e.changedTouches[0]?.clientX ?? 0) - Number((e.currentTarget as HTMLImageElement).dataset.x ?? 0);
              if (Math.abs(dx) > 40) setOpen((open + (dx < 0 ? 1 : -1) + urls.length) % urls.length);
            }}
          />
          {urls.length > 1 && (
            <button type="button" onClick={(e) => { e.stopPropagation(); setOpen((open + 1) % urls.length); }} className="absolute right-3 grid size-11 place-items-center rounded-full bg-white/15 text-white" aria-label="Photo suivante">
              <ChevronRight className="size-6" aria-hidden />
            </button>
          )}
          <span className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] text-sm font-semibold text-white/80 tabular-nums">
            {open + 1} / {urls.length}
          </span>
        </div>
      )}
    </section>
  );
}
