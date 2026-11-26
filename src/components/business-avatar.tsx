import { getCategory } from "@/config/categories";
import { CategoryIcon } from "./category-icon";

const PALETTE = ["#1758e6", "#0f8a5f", "#7c3aed", "#d9480f", "#0e7490", "#be185d", "#4d7c0f", "#b45309"];

function hash(value: string): number {
  let h = 0;
  for (const ch of value) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export function BusinessAvatar({ name, category, coverUrl, size = "md" }: { name: string; category: string; coverUrl?: string | null; size?: "sm" | "md" | "lg" }) {
  const dims = size === "lg" ? "size-24 text-3xl" : size === "sm" ? "size-12 text-base" : "size-16 text-xl";
  if (coverUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={coverUrl} alt="" className={`${dims} shrink-0 rounded-xl object-cover`} />;
  }
  const cat = getCategory(category);
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  return (
    <span className={`${dims} relative grid shrink-0 place-items-center rounded-xl font-bold text-white`} style={{ background: PALETTE[hash(name) % PALETTE.length] }}>
      {initials}
      {cat && (
        <span className="absolute -bottom-1 -right-1 grid size-6 place-items-center rounded-full border-2 border-surface bg-surface text-ink">
          <CategoryIcon name={cat.icon} className="size-3.5" />
        </span>
      )}
    </span>
  );
}
