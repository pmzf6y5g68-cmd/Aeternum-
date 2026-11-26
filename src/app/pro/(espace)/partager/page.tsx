import QRCode from "qrcode";
import { AtSign, Download, Gift, MapPinned, Mic } from "lucide-react";
import { referralUrl } from "@/lib/referral";
import { createAdminClient } from "@/lib/supabase/admin";
import { CopyButton } from "@/components/copy-button";
import { fr } from "@/i18n/fr";
import { siteConfig } from "@/config/site";
import { requireBusiness, shareBusinessUrl } from "@/lib/pro";

export default async function SharePage() {
  const { business } = await requireBusiness();
  // Les filleuls ne sont pas lisibles par RLS (autres établissements) : simple comptage côté serveur.
  const { count: referrals } = await createAdminClient().from("businesses").select("id", { count: "exact", head: true }).eq("referred_by", business.id);
  const refLink = referralUrl(business.referral_code);
  const url = shareBusinessUrl(business);
  const googleLink = `${url}&utm_source=google&utm_medium=business_profile`;
  const qr = await QRCode.toDataURL(url, { width: 640, margin: 2, color: { dark: "#0B1F3A", light: "#FFFFFF" } });
  const short = url.replace(/^https?:\/\//, "").replace("?via=pro", "");
  const voicemail = `Bonjour, vous êtes bien chez ${business.name}. Je ne peux pas vous répondre pour le moment. Le plus rapide pour prendre rendez-vous, c'est en ligne sur ${short} : vous verrez le prix et mes disponibilités en temps réel. À très vite !`;
  const origin = siteConfig.url.replace(/\/$/, "");
  const embed = `<script src="${origin}/embed.js" data-business="${business.slug}" async></script>`;
  const inline = `<div id="rdv-booking"></div>\n<script src="${origin}/embed.js" data-business="${business.slug}" data-mode="inline" async></script>`;
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
      <section id="parrainage" className="card scroll-mt-24 border-brand/30 bg-brand-softer">
        <h2 className="flex items-center gap-2 font-bold">
          <Gift className="size-5 text-brand" aria-hidden /> Recommandez Rendez-vous : 1 mois offert pour vous et pour lui
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          Partagez ce lien à un confrère, un voisin commerçant ou votre réseau. Dès son premier paiement Pro, vous recevez chacun un mois offert, sans limite de parrainages.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input readOnly value={refLink} className="input font-medium" aria-label="Lien de parrainage" />
          <CopyButton value={refLink} />
        </div>
        {(referrals ?? 0) > 0 && <p className="mt-2 text-sm font-semibold text-brand">{referrals} professionnel{(referrals ?? 0) > 1 ? "s" : ""} inscrit{(referrals ?? 0) > 1 ? "s" : ""} grâce à vous.</p>}
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
      <section id="widget" className="card scroll-mt-24">
        <h2 className="font-bold">Réservation sur votre site web</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Vos visiteurs réservent sans quitter votre site : un bouton flottant ouvre votre agenda en temps réel. Collez cette ligne avant la balise <code>&lt;/body&gt;</code> (Wix, WordPress, Squarespace, Shopify…).
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-canvas p-3 text-xs">{embed}</pre>
        <div className="mt-2">
          <CopyButton value={embed} />
        </div>
        <p className="mt-4 text-sm text-ink-soft">Ou affichez l&apos;agenda directement dans une page :</p>
        <pre className="mt-2 overflow-x-auto rounded-lg bg-canvas p-3 text-xs">{inline}</pre>
        <div className="mt-2">
          <CopyButton value={inline} />
        </div>
        <p className="mt-3 text-xs text-ink-soft">Les réservations faites depuis votre site sont comptées comme vos clients directs.</p>
      </section>
      <section className="card">
        <h2 className="font-bold">Simple bouton (lien)</h2>
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
        <section className="card md:col-span-2">
          <h2 className="flex items-center gap-2 font-bold">
            <MapPinned className="size-4 text-brand" aria-hidden /> Bouton « Réserver » sur Google Maps et Google Recherche
          </h2>
          <p className="mt-1 text-sm text-ink-soft">Les clients qui vous trouvent sur Google réservent en 1 clic, sans appeler. 2 minutes, gratuit.</p>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm">
            <li>
              Ouvrez{" "}
              <a href="https://business.google.com/" target="_blank" rel="noopener noreferrer" className="font-semibold text-brand underline">
                business.google.com
              </a>{" "}
              (ou cherchez le nom de votre établissement sur Google en étant connecté).
            </li>
            <li>Cliquez sur « Modifier le profil », puis sur « Réservations » (ou « Liens de réservation »).</li>
            <li>Collez votre lien ci-dessous et enregistrez. Le bouton apparaît sous quelques jours.</li>
          </ol>
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-canvas p-2.5">
            <code className="min-w-0 flex-1 truncate text-sm">{googleLink}</code>
            <CopyButton value={googleLink} />
          </div>
          <p className="mt-2 text-xs text-ink-soft">Les réservations venues de ce lien sont comptées comme vos propres clients : jamais de commission.</p>
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
