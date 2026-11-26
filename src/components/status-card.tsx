import { CheckCircle2, CircleAlert, XCircle } from "lucide-react";
import { Logo } from "./logo";

export function StatusCard({
  tone,
  title,
  children,
}: {
  tone: "success" | "warning" | "neutral";
  title: string;
  children?: React.ReactNode;
}) {
  const Icon = tone === "success" ? CheckCircle2 : tone === "warning" ? CircleAlert : XCircle;
  const color = tone === "success" ? "text-brand" : tone === "warning" ? "text-amber-500" : "text-slate-400";
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <div className="card p-7 text-center">
          <Icon className={`mx-auto size-12 ${color}`} aria-hidden />
          <h1 className="mt-4 text-xl font-bold">{title}</h1>
          <div className="mt-2 space-y-3 text-sm text-ink-soft">{children}</div>
        </div>
      </div>
    </main>
  );
}
