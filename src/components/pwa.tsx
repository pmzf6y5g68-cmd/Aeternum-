"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "rdv-install-dismissed";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

/** Enregistre le service worker et propose l'installation (Android/Windows/macOS : bouton, iOS : consigne). */
export function Pwa() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => undefined);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone || readDismissed()) return;

    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (isIos) {
      setIos(true);
      timer = setTimeout(() => setVisible(true), 20000);
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      if (timer) clearTimeout(timer);
    };
  }, []);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Stockage indisponible (navigation privée) : on masque simplement.
    }
  }

  if (!visible) return null;
  return (
    <div className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border border-line bg-white p-3 shadow-(--shadow-pop) sm:inset-x-auto sm:right-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-brand text-white">
        <Download className="size-5" aria-hidden />
      </span>
      <p className="min-w-0 flex-1 text-sm">
        <span className="block font-bold">Installer l&apos;application</span>
        {ios ? (
          <span className="text-ink-soft">
            Touchez <Share className="inline size-3.5" aria-label="Partager" /> puis « Sur l&apos;écran d&apos;accueil ».
          </span>
        ) : (
          <span className="text-ink-soft">Vos rendez-vous en un geste, même hors navigateur.</span>
        )}
      </p>
      {deferred && (
        <button
          type="button"
          className="btn-primary px-3 py-2 text-sm"
          onClick={async () => {
            await deferred.prompt();
            await deferred.userChoice;
            setDeferred(null);
            dismiss();
          }}
        >
          Installer
        </button>
      )}
      <button type="button" onClick={dismiss} className="btn-ghost size-8 p-0" aria-label="Fermer">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
