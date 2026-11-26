import { StarRow, Stars } from "@/components/stars";
import { SubmitButton } from "@/components/submit-button";
import { fr } from "@/i18n/fr";
import { requireBusiness } from "@/lib/pro";
import type { Review } from "@/lib/supabase/types";
import { reviewPhotoUrl } from "@/lib/review-photos";
import { removeReviewPhotos, replyReview } from "../actions";

export default async function ReviewsPage() {
  const { supabase, business } = await requireBusiness();
  const { data } = await supabase.from("reviews").select("*").eq("business_id", business.id).order("created_at", { ascending: false }).limit(100).returns<Review[]>();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{fr.dashboard.nav.reviews}</h1>
        <Stars rating={Number(business.rating_avg)} count={business.rating_count} size="md" />
      </div>
      <p className="text-sm text-ink-soft">Seuls les clients venus à un rendez-vous peuvent laisser un avis : une demande leur est envoyée quand vous marquez le RDV « Terminé ».</p>
      {(data ?? []).length === 0 && <p className="card text-sm text-ink-soft">{fr.business.noReviews}</p>}
      <ul className="space-y-3">
        {(data ?? []).map((r) => (
          <li key={r.id} className="card space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold">{r.author_name}</span>
              <span className="text-xs text-ink-soft">{new Date(r.created_at).toLocaleDateString("fr-FR")}</span>
            </div>
            <StarRow value={r.rating} />
            {r.comment && <p className="text-sm text-ink-soft">{r.comment}</p>}
            {r.photos?.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                {r.photos.map((ph) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={ph} src={reviewPhotoUrl(ph)} alt="Photo du client" className="size-16 rounded-lg border border-line object-cover" />
                ))}
                <form action={removeReviewPhotos}>
                  <input type="hidden" name="id" value={r.id} />
                  <SubmitButton className="btn-ghost px-2 py-1 text-xs text-danger">Signaler et retirer les photos</SubmitButton>
                </form>
              </div>
            )}
            <form action={replyReview} className="flex flex-col gap-2 sm:flex-row">
              <input type="hidden" name="id" value={r.id} />
              <input name="reply" defaultValue={r.reply ?? ""} maxLength={1500} placeholder="Répondre publiquement…" className="input" />
              <SubmitButton className="btn-secondary">{fr.common.save}</SubmitButton>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
