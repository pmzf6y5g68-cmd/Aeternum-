import { Star } from "lucide-react";

export function Stars({ rating, count, size = "sm" }: { rating: number; count: number; size?: "sm" | "md" }) {
  if (count === 0) return null;
  const s = size === "md" ? "size-4" : "size-3.5";
  return (
    <span className="inline-flex items-center gap-1 text-sm">
      <Star className={`${s} fill-sun text-sun`} aria-hidden />
      <span className="font-semibold text-ink">{Number(rating).toFixed(1).replace(".", ",")}</span>
      <span className="text-ink-soft">({count})</span>
    </span>
  );
}

export function StarRow({ value }: { value: number }) {
  return (
    <span className="inline-flex" aria-label={`${value} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`size-3.5 ${i <= value ? "fill-sun text-sun" : "text-line"}`} aria-hidden />
      ))}
    </span>
  );
}
