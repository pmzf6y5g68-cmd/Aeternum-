import Link from "next/link";
import { CalendarCheck } from "lucide-react";

export function Logo({ href = "/", tone = "dark" }: { href?: string; tone?: "dark" | "light" }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2 font-bold tracking-tight ${tone === "light" ? "text-white" : "text-ink"}`}>
      <span className={`grid size-8 place-items-center rounded-lg ${tone === "light" ? "bg-white text-brand" : "bg-brand text-white"}`}>
        <CalendarCheck className="size-4.5" aria-hidden />
      </span>
      <span className="text-lg">Rendez-vous</span>
    </Link>
  );
}
