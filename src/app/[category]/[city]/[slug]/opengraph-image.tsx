import { ImageResponse } from "next/og";
import { getCategory } from "@/config/categories";
import { loadPublicBusiness } from "@/lib/marketplace";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Réserver en ligne sur Rendez-vous";

/** Image de partage (Google Discover, réseaux sociaux, aperçus dans les assistants IA). */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const b = await loadPublicBusiness(slug).catch(() => null);
  const cat = b ? getCategory(b.category) : null;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#1758e6", color: "white", padding: 72, fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, fontWeight: 700 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: "white", color: "#1758e6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 34 }}>✓</div>
          Rendez-vous
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 30, opacity: 0.85 }}>{[cat?.label, b?.city].filter(Boolean).join(" · ") || "Prise de rendez-vous en ligne"}</div>
          <div style={{ fontSize: 76, fontWeight: 800, lineHeight: 1.05 }}>{b?.name ?? "Tous vos rendez-vous"}</div>
          <div style={{ display: "flex", gap: 28, fontSize: 32, marginTop: 8 }}>
            {b && b.rating_count > 0 && <span>★ {Number(b.rating_avg).toFixed(1).replace(".", ",")} ({b.rating_count} avis)</span>}
            {b?.min_price_eur != null && <span>dès {Number(b.min_price_eur)} €</span>}
          </div>
        </div>
        <div style={{ display: "flex", alignSelf: "flex-start", background: "#ffc93c", color: "#0b1f3a", borderRadius: 14, padding: "16px 28px", fontSize: 34, fontWeight: 800 }}>Réserver en ligne 24 h/24</div>
      </div>
    ),
    size,
  );
}
