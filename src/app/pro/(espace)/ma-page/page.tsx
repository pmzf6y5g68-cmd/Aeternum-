import Link from "next/link";
import { Camera, ExternalLink, Star, Trash2 } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { getCategory } from "@/config/categories";
import { fr } from "@/i18n/fr";
import { requireBusiness } from "@/lib/pro";
import { businessPath } from "@/lib/slug";
import { BUSINESS_PHOTO_MAX, publicStorageUrl } from "@/lib/images";
import { managePhoto, updatePage, updateRules, uploadBusinessPhotos } from "../actions";

export default async function MyPage() {
  const { business: b } = await requireBusiness();
  const cat = getCategory(b.category);
  const photos = b.photos ?? [];
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{fr.dashboard.nav.page}</h1>
          <p className="text-sm text-ink-soft">{cat?.label} · visible dans la recherche, les pages métier et ville.</p>
        </div>
        <Link href={businessPath(b)} target="_blank" className="btn-secondary">
          Voir ma page <ExternalLink className="size-4" aria-hidden />
        </Link>
      </div>

      <section className="card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-bold">
              <Camera className="size-4 text-brand" aria-hidden /> Photos
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              {photos.length >= 3
                ? "Belle galerie. La première photo s'affiche dans les résultats de recherche."
                : "Les clients choisissent d'abord avec les yeux : les fiches avec au moins 3 photos sont bien plus réservées. Montrez le lieu, l'équipe, un résultat."}
            </p>
          </div>
          <span className="text-sm font-semibold tabular-nums text-ink-soft">
            {photos.length}/{BUSINESS_PHOTO_MAX}
          </span>
        </div>
        {photos.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {photos.map((ph, i) => (
              <li key={ph} className="group relative overflow-hidden rounded-xl border border-line">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={publicStorageUrl("business-photos", ph)} alt={`Photo ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
                {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-white/95 px-2 py-0.5 text-xs font-semibold text-ink">Couverture</span>}
                <div className="absolute inset-x-0 bottom-0 flex justify-end gap-1 bg-gradient-to-t from-black/50 to-transparent p-2">
                  {i > 0 && (
                    <form action={managePhoto}>
                      <input type="hidden" name="path" value={ph} />
                      <input type="hidden" name="op" value="cover" />
                      <SubmitButton className="grid size-8 place-items-center rounded-full bg-white/95 text-ink hover:bg-surface">
                        <Star className="size-4" aria-label="Mettre en couverture" />
                      </SubmitButton>
                    </form>
                  )}
                  <form action={managePhoto}>
                    <input type="hidden" name="path" value={ph} />
                    <input type="hidden" name="op" value="delete" />
                    <SubmitButton className="grid size-8 place-items-center rounded-full bg-white/95 text-danger hover:bg-surface">
                      <Trash2 className="size-4" aria-label="Supprimer la photo" />
                    </SubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
        {photos.length < BUSINESS_PHOTO_MAX && (
          <form action={uploadBusinessPhotos} className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-dashed border-line p-4">
            <input name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple required className="min-w-0 flex-1 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-semibold file:text-brand" />
            <SubmitButton>Ajouter les photos</SubmitButton>
            <p className="w-full text-xs text-ink-soft">JPEG, PNG ou WebP, 5 Mo maximum chacune. Depuis votre téléphone, vous pouvez prendre la photo directement.</p>
          </form>
        )}
      </section>

      <form action={updatePage} className="card grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Nom de l&apos;établissement</label>
          <input name="name" required defaultValue={b.name} className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Accroche (affichée dans les résultats)</label>
          <input name="tagline" maxLength={140} defaultValue={b.tagline ?? ""} placeholder="Ex. Spécialiste du balayage naturel depuis 2012" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Présentation</label>
          <textarea name="description" rows={5} maxLength={3000} defaultValue={b.description ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Points forts (un par ligne)</label>
          <textarea name="highlights" rows={3} defaultValue={b.highlights.join("\n")} placeholder={"Parking gratuit\nAccès PMR\nWi-Fi"} className="input" />
        </div>
        <div>
          <label className="label">Moyens de paiement (un par ligne)</label>
          <textarea name="payment_methods" rows={3} defaultValue={b.payment_methods.join("\n")} className="input" />
        </div>
        <div>
          <label className="label">Email de contact</label>
          <input name="email" type="email" required defaultValue={b.email} className="input" />
        </div>
        <div>
          <label className="label">Téléphone</label>
          <input name="phone" type="tel" defaultValue={b.phone ?? ""} className="input" />
        </div>
        <div>
          <label className="label">Site web</label>
          <input name="website" type="url" defaultValue={b.website ?? ""} placeholder="https://" className="input" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Adresse (ou point de départ)</label>
          <input name="address" required defaultValue={b.address ?? ""} className="input" />
        </div>
        <fieldset className="sm:col-span-2">
          <legend className="label">Lieux d&apos;intervention</legend>
          <div className="flex flex-wrap gap-4">
            {(["on_site", "at_home", "online"] as const).map((m) => (
              <label key={m} className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name="modes" value={m} defaultChecked={b.modes.includes(m)} className="size-4 accent-[#1758E6]" /> {fr.modes[m]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex items-center justify-between gap-3 sm:col-span-2">
          <label className="inline-flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" name="published" defaultChecked={b.published} className="size-4 accent-[#1758E6]" /> Page publiée dans la recherche
          </label>
          <SubmitButton>{fr.common.save}</SubmitButton>
        </div>
      </form>

      <section>
        <h2 className="mb-3 text-lg font-bold">Règles de réservation & zone</h2>
        <form action={updateRules} className="card grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">Pas des créneaux</label>
            <select name="slot_step_minutes" defaultValue={b.slot_step_minutes} className="input">
              {[10, 15, 20, 30, 45, 60].map((v) => (
                <option key={v} value={v}>
                  {v} min
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Délai minimum (min)</label>
            <input name="min_lead_minutes" type="number" min={0} step={15} defaultValue={b.min_lead_minutes} className="input" />
          </div>
          <div>
            <label className="label">Réservable jusqu&apos;à (jours)</label>
            <input name="max_days_ahead" type="number" min={1} max={365} defaultValue={b.max_days_ahead} className="input" />
          </div>
          <div>
            <label className="label">Annulation gratuite jusqu&apos;à (h avant)</label>
            <input name="cancellation_hours" type="number" min={0} max={336} defaultValue={b.cancellation_hours} className="input" />
          </div>
          <div>
            <label className="label">Relance fidélisation (jours)</label>
            <input name="rebooking_days" type="number" min={7} max={730} defaultValue={b.rebooking_days} className="input" />
          </div>
          <div>
            <label className="label">Tampon trajet domicile (min)</label>
            <input name="travel_buffer_minutes" type="number" min={0} max={240} step={5} defaultValue={b.travel_buffer_minutes} className="input" />
          </div>
          <div>
            <label className="label">Déplacement offert (km)</label>
            <input name="free_radius_km" type="number" min={0} step="0.5" defaultValue={b.free_radius_km} className="input" />
          </div>
          <div>
            <label className="label">Rayon maximum (km)</label>
            <input name="max_radius_km" type="number" min={0} step="0.5" defaultValue={b.max_radius_km} className="input" />
          </div>
          <div>
            <label className="label">Prix par km au-delà (€)</label>
            <input name="price_per_extra_km" type="number" min={0} step="0.05" defaultValue={b.price_per_extra_km} className="input" />
          </div>
          <div>
            <label className="label">Bloquer après N absences (0 = jamais)</label>
            <input name="no_show_block_threshold" type="number" min={0} max={10} defaultValue={b.no_show_block_threshold} className="input" />
          </div>
          <div className="text-right sm:col-span-2 sm:self-end">
            <SubmitButton>{fr.common.save}</SubmitButton>
          </div>
        </form>
      </section>
    </div>
  );
}
