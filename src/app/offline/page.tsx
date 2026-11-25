import { WifiOff } from "lucide-react";
import { Logo } from "@/components/logo";

export const metadata = { title: "Hors ligne" };

export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4">
      <div className="card max-w-sm text-center">
        <div className="mb-4 flex justify-center">
          <Logo />
        </div>
        <WifiOff className="mx-auto size-10 text-ink-soft" aria-hidden />
        <h1 className="mt-3 text-xl font-bold">Vous êtes hors ligne</h1>
        <p className="mt-2 text-sm text-ink-soft">Les disponibilités sont toujours affichées en temps réel : reconnectez-vous pour réserver ou voir vos rendez-vous.</p>
      </div>
    </main>
  );
}
