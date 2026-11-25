import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Rendez-vous — tous vos rendez-vous, au même endroit";

export default function Image() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", gap: 24, background: "#1758e6", color: "white", padding: 80, fontFamily: "sans-serif" }}>
        <div style={{ fontSize: 40, fontWeight: 700 }}>Rendez-vous</div>
        <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05 }}>Tous vos rendez-vous, au même endroit</div>
        <div style={{ fontSize: 34, opacity: 0.9 }}>Coiffeur, garage, coach, avocat, restaurant, plombier… Réservez en ligne 24 h/24.</div>
      </div>
    ),
    size,
  );
}
