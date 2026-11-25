import QRCode from "qrcode";
import { Download, AtSign, MapPinned, Mic } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { format } from "@/i18n";
import { fr } from "@/i18n/fr";
import { publicStudioUrl, requireStudio } from "@/lib/studio";

const t = fr.dashboard.share;

export default async function SharePage() {
  const { studio } = await requireStudio();
  const url = publicStudioUrl(studio.slug);
  const qr = await QRCode.toDataURL(url, { width: 640, margin: 2, color: { dark: "#0F172A", light: "#FFFFFF" } });
  const voicemail = format(t.voicemail, { name: studio.name, url: url.replace(/^https?:\/\//, "") });

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">{t.title}</h1>

      <section className="card">
        <h2 className="label">{t.link}</h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input readOnly value={url} className="input font-medium" aria-label={t.link} />
          <CopyButton value={url} label={t.copy} copiedLabel={t.copied} />
        </div>
      </section>

      <section className="card flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt={t.qr} width={180} height={180} className="rounded-xl border border-slate-200" />
        <div className="space-y-3 text-center sm:text-left">
          <h2 className="font-semibold">{t.qr}</h2>
          <p className="text-sm text-slate-600">Imprimez-le sur vos cartes de visite, votre vitrine ou votre véhicule.</p>
          <a href={qr} download={`qr-${studio.slug}.png`} className="btn-primary">
            <Download className="size-4" aria-hidden /> {t.downloadQr}
          </a>
        </div>
      </section>

      <section className="card">
        <h2 className="flex items-center gap-2 font-semibold">
          <Mic className="size-4 text-accent" aria-hidden /> {t.voicemailTitle}
        </h2>
        <p className="mt-3 rounded-xl bg-muted p-4 text-sm leading-relaxed">{voicemail}</p>
        <div className="mt-3">
          <CopyButton value={voicemail} label={t.copy} copiedLabel={t.copied} />
        </div>
      </section>

      <div className="grid gap-5 sm:grid-cols-2">
        <section className="card">
          <h2 className="flex items-center gap-2 font-semibold">
            <MapPinned className="size-4 text-accent" aria-hidden /> {t.mapsTitle}
          </h2>
          <p className="mt-2 text-sm text-slate-600">{t.maps}</p>
        </section>
        <section className="card">
          <h2 className="flex items-center gap-2 font-semibold">
            <AtSign className="size-4 text-accent" aria-hidden /> {t.instagramTitle}
          </h2>
          <p className="mt-2 text-sm text-slate-600">{t.instagram}</p>
        </section>
      </div>
    </div>
  );
}
