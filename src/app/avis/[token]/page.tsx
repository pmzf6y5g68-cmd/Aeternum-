import type { Metadata } from "next";
import { StarInput } from "@/components/star-input";
import { StatusCard } from "@/components/status-card";
import { SubmitButton } from "@/components/submit-button";
import { format } from "@/i18n";
import { fr } from "@/i18n/fr";
import { loadBookingByToken } from "@/lib/booking-token";
import { createAdminClient } from "@/lib/supabase/admin";
import { submitReview } from "./actions";
import { canReview } from "./review-rules";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Votre avis", robots: { index: false } };

const t = fr.review;

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ merci?: string }> }) {
  const [{ token }, { merci }] = await Promise.all([params, searchParams]);
  const found = await loadBookingByToken(token);
  if (!found) return <StatusCard tone="neutral" title={t.invalid} />;
  const { data: existing } = await createAdminClient().from("reviews").select("id").eq("booking_id", found.booking.id).maybeSingle();
  if (merci || existing) return <StatusCard tone="success" title={t.thanks} />;
  if (!canReview(found.booking)) return <StatusCard tone="neutral" title={t.invalid} />;

  return (
    <StatusCard tone="success" title={format(t.title, { business: found.business.name })}>
      <form action={submitReview} className="space-y-4 text-left">
        <input type="hidden" name="token" value={token} />
        <fieldset>
          <legend className="label text-center">{t.rating}</legend>
          <StarInput name="rating" />
        </fieldset>
        <div>
          <label className="label" htmlFor="comment">
            {t.comment}
          </label>
          <textarea id="comment" name="comment" rows={4} maxLength={1500} className="input" />
        </div>
        <div>
          <label htmlFor="photos" className="label">
            Photos (facultatif, 3 maximum)
          </label>
          <input id="photos" name="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-2 file:font-semibold file:text-brand" />
          <p className="mt-1 text-xs text-ink-soft">Le résultat, l&apos;ambiance… Les photos sont publiées avec votre avis.</p>
        </div>
        <SubmitButton className="btn-primary w-full">{t.submit}</SubmitButton>
      </form>
    </StatusCard>
  );
}
