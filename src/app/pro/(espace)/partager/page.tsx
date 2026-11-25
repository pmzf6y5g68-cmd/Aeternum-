import QRCode from "qrcode";
import { AtSign, Download, MapPinned, Mic } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { fr } from "@/i18n/fr";
import { requireBusiness, shareBusinessUrl } from "@/lib/pro";

export default async function SharePage() {
  const { business } = await requireBusiness();
  const url = shareBusinessUrl(business);
  const qr = await QRCode.toDataURL(url, { width: 640, margin: 2, color: { dark: "#0B1F3A", light: "#FFFFFF" } });
  const short = url.replace(/^https?:\/\//, "").replace("?via=pro", "");
  const voicemail = `Bonjour, vous êtes bien chez ${business.name}. Je ne peux pas vous répondre pour le moment. Le plus rapide pour prendre rendez-vous, c'est en ligne sur ${short} : vous verrez le prix et mes disponibilités en temps réel. À très vite !`;
  const widget = `<a href="${url}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#1758E6;color:#fff;font:600 15px system-ui;text-decoration:none">Prendre rendez-vous</a>`;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">{fr.dashboard.nav.share}</h1>
      <section className="card">
        <h2 className="label">Votre lien de réservation</h2>
        <p className="mb-2 text-sm text-ink-soft">Les clients qui réservent par ce lien, votre QR code ou votre bouton sont les vôtres : jamais de commission, quel que soit votre plan.</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input readOnly value={url} className="input font-medium" aria-label="Lien" />
          <CopyButton value={url} />
        </div>
      </section>
      <section className="card flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt="QR code" width={170} height={170} className="rounded-lg border border-line" />
        <div className="space-y-3 text-center sm:text-left">
          <h2 className="font-bold">QR code</h2>
          <p className="text-sm text-ink-soft">À imprimer en vitrine, sur vos cartes, flyers ou votre véhicule.</p>
          <a href={qr} download={`qr-${business.slug}.png`} className="btn-primary">
            <Download className="size-4" aria-hidden /> Télécharger
          </a>
        </div>
      </section>
      <section className="card">
        <h2 className="font-bold">Bouton pour votre site web</h2>
        <p className="mt-1 text-sm text-ink-soft">Copiez ce code dans votre site (Wix, WordPress, Squarespace…).</p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-canvas p-3 text-xs">{widget}</pre>
        <div className="mt-2">
          <CopyButton value={widget} />
        </div>
      </section>
      <section className="card">
        <h2 className="flex items-center gap-2 font-bold">
          <Mic className="size-4 text-brand" aria-hidden /> Message de répondeur
        </h2>
        <p className="mt-3 rounded-lg bg-canvas p-4 text-sm leading-relaxed">{voicemail}</p>
        <div className="mt-3">
          <CopyButton value={voicemail} />
        </div>
      </section>
      <div className="grid gap-5 sm:grid-cols-2">
        <section className="card">
          <h2 className="flex items-center gap-2 font-bold">
            <MapPinned className="size-4 text-brand" aria-hidden /> Google Maps
          </h2>
          <p className="mt-2 text-sm text-ink-soft">Fiche Google Business › Modifier le profil › Liens de réservation : collez votre lien.</p>
        </section>
        <section className="card">
          <h2 className="flex items-center gap-2 font-bold">
            <AtSign className="size-4 text-brand" aria-hidden /> Réseaux sociaux
          </h2>
          <p className="mt-2 text-sm text-ink-soft">Instagram, Facebook, TikTok : ajoutez le lien dans votre bio avec le libellé « Réserver ».</p>
        </section>
      </div>
    </div>
  );
}
