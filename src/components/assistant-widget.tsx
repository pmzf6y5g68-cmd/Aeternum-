"use client";

import { isBusinessPage, mobileBar } from "@/lib/mobile-chrome";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { CalendarDays, LocateFixed, Loader2, MapPin, Send, Sparkles, Star, X } from "lucide-react";

type Card =
  | { type: "business"; name: string; category: string; city: string | null; distanceKm: number | null; priceFrom: number | null; rating: number; ratingCount: number; href: string; nextSlot: string | null; sponsored: boolean }
  | { type: "slots"; businessName: string; serviceName: string; days: { date: string; slots: { time: string; href: string }[] }[]; href: string }
  | { type: "appointment"; businessName: string; serviceName: string; startAt: string; status: string; href: string }
  | { type: "link"; label: string; href: string };

interface Msg {
  role: "user" | "assistant";
  content: string;
  cards?: Card[];
}

const STORAGE_KEY = "rdv-assistant";
const SUGGESTIONS = ["Qu'y a-t-il autour de chez moi ?", "Un coiffeur dispo demain soir près de moi", "Combien coûte une vidange ?", "Mes prochains rendez-vous"];
/** Sur une fiche établissement (/metier/ville/slug), les questions qu'on se pose vraiment. */
const BUSINESS_SUGGESTIONS = ["C'est ouvert maintenant ?", "Le prochain créneau libre ?", "Que disent les avis ?", "Quelles sont les conditions d'annulation ?"];
const POSITION_KEY = "rdv_position";
const WELCOME: Msg = { role: "assistant", content: "Bonjour ! Je trouve un professionnel et un créneau pour vous en quelques secondes. Que cherchez-vous ?" };

const fmtDay = (d: string) => new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${d}T12:00:00Z`));
const fmtWhen = (iso: string) => new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(iso));
const price = (eur: number | null) => (eur === null ? "" : eur === 0 ? "Gratuit" : `dès ${new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: Number.isInteger(eur) ? 0 : 2 }).format(eur)}`);

function CardView({ card, onNavigate }: { card: Card; onNavigate: () => void }) {
  if (card.type === "business") {
    return (
      <Link href={card.href} onClick={onNavigate} className="block rounded-lg border border-line bg-surface p-3 hover:border-brand">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0">
            <span className="block truncate font-bold text-brand">{card.name}</span>
            <span className="block text-xs text-ink-soft">
              {card.category}
              {card.city ? ` · ${card.city}` : ""}
              {card.distanceKm !== null ? ` · ${card.distanceKm.toFixed(1).replace(".", ",")} km` : ""}
            </span>
          </span>
          <span className="shrink-0 text-right text-xs">
            {card.ratingCount > 0 && (
              <span className="inline-flex items-center gap-0.5 font-semibold">
                <Star className="size-3 fill-sun text-sun" aria-hidden /> {card.rating.toFixed(1).replace(".", ",")}
              </span>
            )}
            <span className="block text-ink-soft">{price(card.priceFrom)}</span>
          </span>
        </span>
        {card.nextSlot && <span className="mt-1.5 inline-block rounded bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand">Dispo {fmtWhen(card.nextSlot)}</span>}
        {card.sponsored && <span className="ml-1.5 text-[10px] font-bold uppercase text-ink-soft">Mis en avant</span>}
      </Link>
    );
  }
  if (card.type === "slots") {
    return (
      <div className="rounded-lg border border-line bg-surface p-3">
        <p className="text-sm font-bold">
          {card.businessName} <span className="font-normal text-ink-soft">· {card.serviceName}</span>
        </p>
        {card.days.length === 0 && <p className="mt-1 text-xs text-ink-soft">Pas de créneau cette semaine.</p>}
        {card.days.map((d) => (
          <div key={d.date} className="mt-2">
            <p className="text-xs font-semibold capitalize text-ink-soft">{fmtDay(d.date)}</p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {d.slots.map((s) => (
                <Link key={s.time} href={s.href} onClick={onNavigate} className="slot w-auto px-2.5 py-1 text-xs">
                  {s.time}
                </Link>
              ))}
            </div>
          </div>
        ))}
        <Link href={card.href} onClick={onNavigate} className="mt-2 block text-xs font-semibold text-brand hover:underline">
          Voir toutes les disponibilités
        </Link>
      </div>
    );
  }
  if (card.type === "appointment") {
    return (
      <Link href={card.href} onClick={onNavigate} className="flex items-center gap-3 rounded-lg border border-line bg-surface p-3 hover:border-brand">
        <CalendarDays className="size-5 shrink-0 text-brand" aria-hidden />
        <span className="min-w-0 text-sm">
          <span className="block truncate font-bold">{card.businessName}</span>
          <span className="block text-xs capitalize text-ink-soft">
            {fmtWhen(card.startAt)} · {card.serviceName}
          </span>
        </span>
      </Link>
    );
  }
  return (
    <a href={card.href} onClick={onNavigate} className="btn-secondary w-full py-2 text-sm">
      {card.label}
    </a>
  );
}

/** Assistant IA flottant (toutes les pages publiques). Conversation conservée le temps de la session. */
export function AssistantWidget() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      // Position déjà partagée sur l'accueil (« À côté de chez vous ») : réutilisée sans redemander.
      const pos = JSON.parse(localStorage.getItem(POSITION_KEY) ?? "null") as { lat: number; lng: number } | null;
      if (pos && Number.isFinite(pos.lat) && Number.isFinite(pos.lng)) setLocation({ lat: pos.lat, lng: pos.lng });
    } catch {
      // Stockage indisponible : position non mémorisée.
    }
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setMessages(JSON.parse(saved) as Msg[]);
    } catch {
      // Session indisponible : on repart du message d'accueil.
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-20)));
    } catch {
      // Stockage indisponible : conversation non conservée.
    }
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  if (["/pro", "/paiement", "/widget", "/login", "/auth"].some((p) => pathname.startsWith(p))) return null;

  async function send(text: string) {
    const content = text.trim();
    if (!content || busy) return;
    const next: Msg[] = [...messages, { role: "user", content }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const history = next.filter((m) => m !== WELCOME).slice(-19).map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, location, page: pathname }),
      });
      const data = (await res.json()) as { reply?: string; cards?: Card[]; error?: string };
      const reply =
        res.status === 429
          ? "Vous m'avez envoyé beaucoup de messages : patientez quelques minutes, s'il vous plaît."
          : res.ok
            ? (data.reply ?? "")
            : "Je suis momentanément indisponible. Vous pouvez chercher directement depuis la barre de recherche.";
      setMessages((m) => [...m, { role: "assistant", content: reply, cards: data.cards }]);
    } catch {
      setMessages((m) => [...m, { role: "assistant", content: "Connexion impossible pour le moment." }]);
    } finally {
      setBusy(false);
    }
  }

  function shareLocation() {
    navigator.geolocation?.getCurrentPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude };
        setLocation(pos);
        try {
          localStorage.setItem(POSITION_KEY, JSON.stringify(pos));
        } catch {
          // Stockage indisponible.
        }
      },
      () => undefined,
      { timeout: 8000, maximumAge: 300_000 },
    );
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`fixed ${mobileBar(pathname) === "none" ? "bottom-[max(1rem,env(safe-area-inset-bottom))]" : "bottom-[calc(5rem+env(safe-area-inset-bottom))]"} right-4 z-40 md:bottom-4 inline-flex items-center gap-2 rounded-full bg-brand px-4 py-3 font-semibold text-white shadow-(--shadow-pop) hover:bg-brand-dark`}
          aria-label="Ouvrir l'assistant"
        >
          <Sparkles className="size-5" aria-hidden />
          <span className="hidden sm:inline">Assistant</span>
        </button>
      )}
      {open && (
        <section
          aria-label="Assistant Rendez-vous"
          className="fixed inset-0 z-50 flex flex-col bg-canvas sm:inset-auto sm:bottom-4 sm:right-4 sm:h-[min(42rem,calc(100dvh-2rem))] sm:w-[26rem] sm:overflow-hidden sm:rounded-2xl sm:border sm:border-line sm:shadow-(--shadow-pop)"
        >
          <header className="flex items-center justify-between gap-3 bg-brand px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
            <span className="flex items-center gap-2 font-bold">
              <Sparkles className="size-5" aria-hidden /> Assistant Rendez-vous
            </span>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 hover:bg-white/15" aria-label="Fermer">
              <X className="size-5" aria-hidden />
            </button>
          </header>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                <div className={`max-w-[88%] space-y-2 ${m.role === "user" ? "" : "w-full"}`}>
                  <p className={`whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm ${m.role === "user" ? "rounded-br-sm bg-brand text-white" : "rounded-bl-sm bg-surface text-ink shadow-(--shadow-card)"}`}>{m.content}</p>
                  {m.cards?.map((c, j) => (
                    <CardView key={j} card={c} onNavigate={() => setOpen(false)} />
                  ))}
                </div>
              </div>
            ))}
            {busy && (
              <p className="flex items-center gap-2 text-sm text-ink-soft">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Je cherche…
              </p>
            )}
            {messages.length === 1 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {(isBusinessPage(pathname) ? BUSINESS_SUGGESTIONS : SUGGESTIONS).map((s) => (
                  <button key={s} type="button" onClick={() => send(s)} className="chip text-left text-xs">
                    {s}
                  </button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-center gap-2 border-t border-line bg-surface p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <button type="button" onClick={shareLocation} className={`btn-ghost size-10 shrink-0 p-0 ${location ? "text-success" : ""}`} aria-label="Partager ma position" title={location ? "Position partagée" : "Partager ma position"}>
              {location ? <MapPin className="size-5" aria-hidden /> : <LocateFixed className="size-5" aria-hidden />}
            </button>
            <input value={input} onChange={(e) => setInput(e.target.value)} maxLength={1500} placeholder="Ex. : un barbier samedi matin à Lyon" className="input py-2.5" aria-label="Votre message" />
            <button type="submit" disabled={busy || !input.trim()} className="btn-primary size-10 shrink-0 p-0" aria-label="Envoyer">
              <Send className="size-4" aria-hidden />
            </button>
          </form>
          <p className="bg-surface px-4 pb-2 text-center text-[11px] text-ink-soft">Assistant IA : vérifiez les informations avant de réserver.</p>
        </section>
      )}
    </>
  );
}
