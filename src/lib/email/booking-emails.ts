import "server-only";
import { siteConfig } from "@/config/site";
import { fr } from "@/i18n/fr";
import { formatEur, eurToCents } from "@/lib/domain/pricing";
import { env } from "@/lib/env";
import type { Booking, Studio } from "@/lib/supabase/types";
import { buildIcs } from "./ics";
import { layoutHtml, sendEmail } from "./send";

type StudioContact = Pick<Studio, "name" | "email" | "phone" | "address" | "slug">;

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
  };
}

function where(booking: Booking, studio: StudioContact): string {
  return booking.location_type === "mobile" ? booking.client_address ?? "" : studio.address ?? "";
}

function summaryLines(booking: Booking, serviceName: string, addonNames: string[]): string[] {
  const lines = [
    `Prestation : ${serviceName}${addonNames.length ? ` + ${addonNames.join(", ")}` : ""}`,
    `Véhicule : ${fr.vehicleSizes[booking.vehicle_size]}${booking.vehicle_model ? ` (${booking.vehicle_model})` : ""}`,
    `Total : ${formatEur(eurToCents(booking.total_price_eur))}${booking.travel_fee_eur > 0 ? ` dont ${formatEur(eurToCents(booking.travel_fee_eur))} de déplacement` : ""}`,
  ];
  if (booking.deposit_paid && booking.deposit_amount_eur > 0) {
    lines.push(`Acompte réglé : ${formatEur(eurToCents(booking.deposit_amount_eur))}`);
  }
  return lines;
}

/** Confirmation client + invitation .ics + notification au studio. */
export async function sendBookingConfirmation(
  booking: Booking,
  studio: StudioContact,
  serviceName: string,
  addonNames: string[],
): Promise<void> {
  const when = formatDateTime(booking.start_at);
  const location = where(booking, studio);
  const l = links(booking);
  const details = summaryLines(booking, serviceName, addonNames);

  const ics = buildIcs({
    uid: `${booking.id}@slotly`,
    start: new Date(booking.start_at),
    end: new Date(booking.end_at),
    summary: `${serviceName} — ${studio.name}`,
    description: `${details.join("\n")}\nAnnuler : ${l.cancel}`,
    location,
    organizerName: studio.name,
    organizerEmail: env.emailReplyTo(),
  });

  const intro = `Votre rendez-vous chez ${studio.name} est enregistré pour le ${when}.`;
  const place = booking.location_type === "mobile" ? `Intervention à domicile : ${location}` : `Adresse : ${location}`;
  const contact = studio.phone ? `Contact du studio : ${studio.phone}` : `Contact du studio : ${studio.email}`;

  await sendEmail({
    to: booking.client_email,
    replyTo: studio.email,
    subject: `Rendez-vous confirmé — ${studio.name}, ${when}`,
    text: [`Bonjour ${booking.client_name},`, intro, place, ...details, contact, `Besoin d'annuler ? ${l.cancel}`].join("\n\n"),
    html: layoutHtml("Votre rendez-vous est réservé", [`Bonjour ${booking.client_name},`, intro, place, ...details, contact], [
      { label: "Annuler le rendez-vous", url: l.cancel },
    ]),
    attachments: [{ filename: "rendez-vous.ics", content: ics, contentType: "text/calendar; method=REQUEST" }],
  });

  await sendEmail({
    to: studio.email,
    replyTo: booking.client_email,
    subject: `Nouveau RDV : ${booking.client_name} — ${when}`,
    text: [
      `Nouveau rendez-vous le ${when}.`,
      `Client : ${booking.client_name} — ${booking.client_email}${booking.client_phone ? ` — ${booking.client_phone}` : ""}`,
      place,
      ...details,
      `Agenda : ${env.appUrl()}/dashboard`,
    ].join("\n"),
  });
}

export async function sendReminder(booking: Booking, studio: StudioContact): Promise<void> {
  const when = formatDateTime(booking.start_at);
  const l = links(booking);
  const p = [`Bonjour ${booking.client_name},`, `Petit rappel : votre rendez-vous chez ${studio.name} a lieu ${when}.`, "Merci de confirmer votre venue en un clic :"];
  await sendEmail({
    to: booking.client_email,
    replyTo: studio.email,
    subject: `Rappel : votre RDV ${studio.name} demain — merci de confirmer`,
    text: [...p, `Je confirme : ${l.confirm}`, `Je dois annuler : ${l.cancel}`].join("\n\n"),
    html: layoutHtml("Confirmez votre rendez-vous", p, [
      { label: "Je confirme ma venue", url: l.confirm },
      { label: "Je dois annuler", url: l.cancel },
    ]),
  });
}

export async function sendRiskAlert(booking: Booking, studio: StudioContact): Promise<void> {
  const when = formatDateTime(booking.start_at);
  await sendEmail({
    to: studio.email,
    subject: `⚠️ RDV non confirmé : ${booking.client_name} — ${when}`,
    text: [
      `${booking.client_name} n'a pas encore confirmé son rendez-vous du ${when}.`,
      `Un appel rapide permet souvent d'éviter un lapin : ${booking.client_phone ?? booking.client_email}`,
      `Agenda : ${env.appUrl()}/dashboard`,
    ].join("\n\n"),
  });
}

export async function sendRebooking(booking: Booking, studio: StudioContact, serviceName: string): Promise<void> {
  const url = `${env.appUrl()}/${studio.slug}`;
  const p = [
    `Bonjour ${booking.client_name},`,
    `Il y a quelques mois, ${studio.name} s'est occupé de votre véhicule (${serviceName}).`,
    "Un entretien régulier garde la protection et la brillance au top. Réservez votre prochain créneau en 1 minute :",
  ];
  await sendEmail({
    to: booking.client_email,
    replyTo: studio.email,
    subject: `${studio.name} : c'est le moment d'entretenir votre véhicule`,
    text: [...p, url].join("\n\n"),
    html: layoutHtml("Votre véhicule mérite un entretien", p, [{ label: "Réserver mon créneau", url }]),
  });
}

export async function notifyClientCancelledByStudio(booking: Booking, studio: StudioContact): Promise<void> {
  const when = formatDateTime(booking.start_at);
  const p = [
    `Bonjour ${booking.client_name},`,
    `${studio.name} a dû annuler votre rendez-vous du ${when}.`,
    `Pour reprogrammer ou pour toute question (y compris l'acompte éventuel), contactez le studio : ${studio.phone ?? studio.email}.`,
  ];
  await sendEmail({
    to: booking.client_email,
    replyTo: studio.email,
    subject: `Rendez-vous annulé — ${studio.name}`,
    text: p.join("\n\n"),
    html: layoutHtml("Rendez-vous annulé", p, [{ label: "Choisir un nouveau créneau", url: `${env.appUrl()}/${studio.slug}` }]),
  });
}

export async function notifyStudioCancelledByClient(booking: Booking, studio: StudioContact): Promise<void> {
  const when = formatDateTime(booking.start_at);
  await sendEmail({
    to: studio.email,
    replyTo: booking.client_email,
    subject: `Annulation : ${booking.client_name} — ${when}`,
    text: [
      `${booking.client_name} a annulé son rendez-vous du ${when}. Le créneau est de nouveau disponible.`,
      booking.deposit_paid ? `Un acompte de ${formatEur(eurToCents(booking.deposit_amount_eur))} avait été réglé : à vous de décider d'un éventuel remboursement depuis votre Stripe.` : "",
    ]
      .filter(Boolean)
      .join("\n\n"),
  });
}

export async function notifyClientLatePaymentRefunded(booking: Booking, studio: StudioContact): Promise<void> {
  await sendEmail({
    to: booking.client_email,
    replyTo: studio.email,
    subject: `Créneau indisponible — acompte remboursé (${studio.name})`,
    text: [
      `Bonjour ${booking.client_name},`,
      `Votre paiement est arrivé après l'expiration de la réservation et le créneau a été repris entre-temps. Votre acompte a été intégralement remboursé.`,
      `Choisissez un nouveau créneau : ${env.appUrl()}/${studio.slug}`,
    ].join("\n\n"),
  });
}
