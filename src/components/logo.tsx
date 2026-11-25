import Link from "next/link";
import { CalendarCheck2 } from "lucide-react";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 font-semibold tracking-tight text-ink">
      <span className="grid size-8 place-items-center rounded-lg bg-accent text-white">
        <CalendarCheck2 className="size-4.5" aria-hidden />
      </span>
      <span className="text-lg">Slotly</span>
    </Link>
  );
}
