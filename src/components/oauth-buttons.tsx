import { signInWithProvider } from "@/lib/auth-actions";
import { enabledProviders, type OAuthProviderId } from "@/lib/auth-providers";

function ProviderIcon({ id }: { id: OAuthProviderId }) {
  switch (id) {
    case "google":
      return (
        <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41.8 35.3 44 30 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
      );
    case "apple":
      return (
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="currentColor">
          <path d="M16.37 12.7c-.02-2.24 1.83-3.32 1.91-3.37-1.04-1.52-2.66-1.73-3.24-1.75-1.38-.14-2.69.81-3.39.81-.7 0-1.78-.79-2.92-.77-1.5.02-2.89.87-3.66 2.22-1.56 2.71-.4 6.72 1.12 8.92.74 1.08 1.63 2.29 2.79 2.24 1.12-.04 1.54-.72 2.89-.72 1.35 0 1.73.72 2.91.7 1.2-.02 1.96-1.1 2.7-2.18.85-1.25 1.2-2.46 1.22-2.52-.03-.01-2.33-.9-2.33-3.58zM14.15 6.13c.62-.75 1.03-1.78.92-2.82-.89.04-1.97.59-2.6 1.34-.57.66-1.07 1.72-.94 2.73.99.08 2-.5 2.62-1.25z" />
        </svg>
      );
    case "azure":
      return (
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <path fill="#F25022" d="M2 2h9.5v9.5H2z" />
          <path fill="#7FBA00" d="M12.5 2H22v9.5h-9.5z" />
          <path fill="#00A4EF" d="M2 12.5h9.5V22H2z" />
          <path fill="#FFB900" d="M12.5 12.5H22V22h-9.5z" />
        </svg>
      );
    case "facebook":
      return (
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
          <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.88 11.85v-8.38H7.08V12h3.04V9.36c0-3 1.79-4.67 4.53-4.67 1.31 0 2.69.24 2.69.24v2.95h-1.52c-1.49 0-1.96.93-1.96 1.88V12h3.33l-.53 3.47h-2.8v8.38A12 12 0 0 0 24 12z" />
        </svg>
      );
  }
}

export function OAuthButtons({ next }: { next: string }) {
  const providers = enabledProviders();
  if (!providers.length) return null;
  return (
    <div className="space-y-2.5">
      {providers.map((p) => (
        <form key={p.id} action={signInWithProvider}>
          <input type="hidden" name="provider" value={p.id} />
          <input type="hidden" name="next" value={next} />
          <button
            type="submit"
            className={`flex w-full items-center justify-center gap-3 rounded-xl border px-4 py-3 text-[15px] font-semibold transition active:scale-[.99] ${
              p.id === "apple" ? "border-black bg-black text-white hover:bg-neutral-800" : "border-line bg-white text-ink hover:bg-canvas"
            }`}
          >
            <ProviderIcon id={p.id} /> {p.label}
          </button>
        </form>
      ))}
      <div className="flex items-center gap-3 py-2 text-xs font-medium uppercase tracking-wide text-ink-soft">
        <span className="h-px flex-1 bg-line" /> ou par email <span className="h-px flex-1 bg-line" />
      </div>
    </div>
  );
}
