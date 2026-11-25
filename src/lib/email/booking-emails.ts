import "server-only";
import { siteConfig } from "@/config/site";
import { fr } from "@/i18n/fr";
import { eurToCents, formatEur } from "@/lib/domain/pricing";
import { env } from "@/lib/env";
import { businessPath } from "@/lib/slug";
import type { Booking, Business } from "@/lib/supabase/types";
import { buildIcs } from "./ics";
import { layoutHtml, sendEmail } from "./send";

export type BusinessContact = Pick<Business, "name" | "email" | "phone" | "address" | "slug" | "category" | "city_slug" | "cancellation_hours">;
export const BUSINESS_CONTACT_COLUMNS = "name, email, phone, address, slug, category, city_slug, cancellation_hours" as const;

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: siteConfig.booking.timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function links(booking: Pick<Booking, "confirm_token">) {
  const base = env.appUrl();
  return {
    confirm: `${base}/confirm/${booking.confirm_token}`,
    cancel: `${base}/cancel/${booking.confirm_token}`,
    review: `${base}/avis/${booking.confirm_token}`,
    account: `${base}/compte`,
  };
}

function where(booking: Booking, business: BusinessContact): string {
  if (booking.location_type === "online") return fr.modes.online;
  return booking.location_type === "at_home" ? (booking.client_address ?? "") : (business.address ?? "");
}

function summaryLines(booking: Booking, addonNames: string[], staffName: string | null): string[] {
  const lines = [`Prestation : ${booking.service_name}${booking.variant_label ? ` (${booking.variant_label})` : ""}${addonNames.length ? ` + ${addonNames.join(", ")}` : ""}`];
  if (booking.seats > 1) lines.push(`Places : ${booking.seats}`);
  if (staffName) lines.push(`Avec : ${staffName}`);
  if (booking.total_price_eur > 0) {
    lines.push(`Total : ${formatEur(eurToCents(booking.total_price_eur))}${booking.travel_fee_eur > 0 ? ` dont ${formatEur(eurToCents(booking.travel_fee_eur))} de déplacement` : ""}`);
  }
  if (booking.deposit_paid && booking.deposit_amount_eur > 0) lines.push(`Acompte réglé : ${formatEur(eurToCents(booking.deposit_amount_eur))}`);
  return lines;
}

/** Confirmation usager + invitation .ics + notification à l'établissement. */
export async function sendBookingConfirmation(booking: Booking, business: BusinessContact, addonNames: string[], staffName: string | null): Promise<void> {
  const when = formatDateTime(booking.start_at);
  const location = where(booking, business);
  const l = links(booking);
  const details = summaryLines(booking, addonNames, staffName);

  const ics = buildIcs({
    uid: `${booking.id}@rendez-vous`,
    start: new Date(booking.start_at),
    end: new Date(booking.end_at),
    summary: `${booking.service_name} — ${business.name}`,
    description: `${details.join("\n")}\nGérer : ${l.account}\nAnnuler : ${l.cancel}`,
    location,
    organizerName: business.name,
    organizerEmail: env.emailReplyTo(),
  });

  const intro = `Votre rendez-vous chez ${business.name} est confirmé pour le ${when}.`;
  const place = booking.location_type === "online" ? "Rendez-vous en visio : le lien vous sera communiqué par l'établissement." : booking.location_type === "at_home" ? `À domicile : ${location}` : `Adresse : ${location}`;
  const contact = `Contact : ${business.phone ?? business.email}`;
  const policy = business.cancellation_hours > 0 ? `Annulation gratuite jusqu'à ${business.cancellation_hours} h avant.` : "Annulation gratuite à tout moment.";

  await sendEmail({
    to: booking.client_email,
    replyTo: business.email,
    subject: `Rendez-vous confirmé — ${business.name}, ${when}`,
    text: [`Bonjour ${booking.client_name},`, intro, place, ...details, contact, policy, `Mes rendez-vous : ${l.account}`, `Annuler : ${l.cancel}`].join("\n\n"),
    html: layoutHtml("Votre rendez-vous est confirmé", [`Bonjour ${booking.client_name},`, intro, place, ...details, contact, policy], [
      { label: "Voir mes rendez-vous", url: l.account },
      { label: "Annuler", url: l.cancel },
    ]),
    attachments: [{ filename: "rendez-vous.ics", content: ics, contentType: "text/calendar; method=REQUEST" }],
  });

  await sendEmail({
    to: business.email,
    replyTo: booking.client_email,
    subject: `Nouveau RDV : ${booking.client_name} — ${when}`,
    text: [
      `Nouveau rendez-vous le ${when}.`,
      `Client : ${booking.client_name} — ${booking.client_email}${booking.client_phone ? ` — ${booking.client_phone}` : ""}`,
      place,
      ...details,
      booking.client_notes ? `Message du client : ${booking.client_notes}` : "",
      `Agenda : ${env.appUrl()}/pro/agenda`,
    ]
      .filter(Boolean)
      .join("\n"),
  });
}

export async function sendReminder(booking: Booking, business: BusinessContact): Promise<void> {
  const when = formatDateTime(booking.start_at);
  const l = links(booking);
  const p = [`Bonjour ${booking.client_name},`, `Petit rappel : votre rendez-vous chez ${business.name} (${booking.service_name}) a lieu ${when}.`, "Merci de confirmer votre venue en un clic :"];
  await sendEmail({
    to: booking.client_email,
    replyTo: business.email,
    subject: `Rappel : votre rendez-vous ${business.name} — merci de confirmer`,
    text: [...p, `Je confirme : ${l.confirm}`, `Je dois annuler : ${l.cancel}`].join("\n\n"),
    html: layoutHtml("Confirmez votre rendez-vous", p, [
      { label: "Je confirme ma venue", url: l.confirm },
      { label: "Je dois annuler", url: l.cancel },
    ]),
  });
}

export async function sendRiskAlert(booking: Booking, business: BusinessContact): Promise<void> {
  const when = formatDateTime(booking.start_at);
  await sendEmail({
    to: business.email,
    subject: `⚠️ RDV non confirmé : ${booking.client_name} — ${when}`,
    text: [
      `${booking.client_name} n'a pas encore confirmé son rendez-vous du ${when} (${booking.service_name}).`,
      `Un appel rapide évite souvent une absence : ${booking.client_phone ?? booking.client_email}`,
      `Agenda : ${env.appUrl()}/pro/agenda`,
    ].join("\n\n"),
  });
}

export async function sendRebooking(booking: Booking, business: BusinessContact): Promise<void> {
  const url = `${env.appUrl()}${businessPath(business)}`;
  const p = [
    `Bonjour ${booking.client_name},`,
    `Votre dernier rendez-vous chez ${business.name} (${booking.service_name}) remonte à quelques semaines.`,
    "Envie de reprendre rendez-vous ? Les prochains créneaux sont disponibles en ligne :",
  ];
  await sendEmail({
    to: booking.client_email,
    replyTo: business.email,
    subject: `${business.name} : reprenez rendez-vous en 1 minute`,
    text: [...p, url].join("\n\n"),
    html: layoutHtml("On vous revoit bientôt ?", p, [{ label: "Reprendre rendez-vous", url }]),
  });
}

export async function sendReviewRequest(booking: Booking, business: BusinessContact): Promise<void> {
  const l = links(booking);
  const p = [`Bonjour ${booking.client_name},`, `Comment s'est passé votre rendez-vous chez ${business.name} ?`, "Votre avis aide les autres clients et l'établissement. Cela prend 20 secondes :"];
  await sendEmail({
    to: booking.client_email,
    replyTo: business.email,
    subject: `Votre avis sur ${business.name}`,
    text: [...p, l.review].join("\n\n"),
    html: layoutHtml("Donnez votre avis", p, [{ label: "Noter mon rendez-vous", url: l.review }]),
  });
}

export async function notifyClientCancelledByBusiness(booking: Booking, business: BusinessContact): Promise<void> {
  const when = formatDateTime(booking.start_at);
  const p = [
    `Bonjour ${booking.client_name},`,
    `${business.name} a dû annuler votre rendez-vous du ${when}.`,
    `Pour reprogrammer ou pour toute question (y compris l'acompte éventuel) : ${business.phone ?? business.email}.`,
  ];
  await sendEmail({
    to: booking.client_email,
    replyTo: business.email,
    subject: `Rendez-vous annulé — ${business.name}`,
    text: p.join("\n\n"),
    html: layoutHtml("Rendez-vous annulé", p, [{ label: "Choisir un nouveau créneau", url: `${env.appUrl()}${businessPath(business)}` }]),
  });
}

export async function notifyBusinessCancelledByClient(booking: Booking, business: BusinessContact): Promise<void> {
  const when = formatDateTime(booking.start_at);
  await sendEmail({
    to: business.email,
    replyTo: booking.client_email,
    subject: `Annulation : ${booking.client_name} — ${when}`,
    text: [
      `${booking.client_name} a annulé son rendez-vous du ${when} (${booking.service_name}). Le créneau est de nouveau disponible.`,
      booking.deposit_paid ? `Un acompte de ${formatEur(eurToCents(booking.deposit_amount_eur))} avait été réglé : vous décidez d'un éventuel remboursement depuis votre Stripe.` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  });
}

export async function notifyClientLatePaymentRefunded(booking: Booking, business: BusinessContact): Promise<void> {
  await sendEmail({
    to: booking.client_email,
    replyTo: business.email,
    subject: `Créneau indisponible — acompte remboursé (${business.name})`,
    text: [
      `Bonjour ${booking.client_name},`,
      "Votre paiement est arrivé après l'expiration de la réservation et le créneau a été repris entre-temps. Votre acompte a été intégralement remboursé.",
      `Choisissez un nouveau créneau : ${env.appUrl()}${businessPath(business)}`,
    ].join("\n\n"),
  });
}
