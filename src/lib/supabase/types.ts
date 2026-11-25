import type { LocationMode } from "@/config/categories";
import type { BookingStatus, OpeningHours } from "@/lib/domain/availability";
import type { Variant } from "@/lib/domain/pricing";

export type Plan = "free" | "pro";

export interface Business {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  category: string;
  tagline: string | null;
  description: string | null;
  email: string;
  phone: string | null;
  website: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  city_slug: string | null;
  lat: number | null;
  lng: number | null;
  modes: LocationMode[];
  cover_url: string | null;
  highlights: string[];
  payment_methods: string[];
  free_radius_km: number;
  max_radius_km: number;
  price_per_extra_km: number;
  travel_buffer_minutes: number;
  slot_step_minutes: number;
  min_lead_minutes: number;
  max_days_ahead: number;
  cancellation_hours: number;
  deposit_enabled: boolean;
  deposit_percent: number;
  plan: Plan;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_connect_account_id: string | null;
  stripe_connect_onboarded: boolean;
  rebooking_days: number;
  published: boolean;
  min_price_eur: number | null;
  rating_avg: number;
  rating_count: number;
  no_show_block_threshold: number;
  calendar_token: string;
  updated_at: string;
  locale: "fr" | "en";
  created_at: string;
  referral_code: string;
  referred_by: string | null;
  referral_rewarded_at: string | null;
  quota_nudge_month: string | null;
  quota_block_alert_at: string | null;
  last_report_month: string | null;
}

/** Colonnes exposables publiquement (marketplace). Jamais de Stripe, d'email ou d'owner. */
export const PUBLIC_BUSINESS_COLUMNS =
  "id, slug, name, category, tagline, description, phone, website, address, postal_code, city, city_slug, lat, lng, modes, cover_url, highlights, payment_methods, free_radius_km, max_radius_km, price_per_extra_km, travel_buffer_minutes, slot_step_minutes, min_lead_minutes, max_days_ahead, cancellation_hours, deposit_enabled, deposit_percent, plan, stripe_connect_onboarded, min_price_eur, rating_avg, rating_count, published, locale" as const;

export type PublicBusiness = Omit<
  Business,
  "owner_id" | "email" | "stripe_customer_id" | "stripe_subscription_id" | "stripe_connect_account_id" | "rebooking_days" | "created_at" | "calendar_token" | "no_show_block_threshold" | "updated_at" | "referral_code" | "referred_by" | "referral_rewarded_at" | "quota_nudge_month" | "quota_block_alert_at" | "last_report_month"
>;

export interface Staff {
  id: string;
  business_id: string;
  name: string;
  title: string | null;
  service_ids: string[];
  active: boolean;
  sort: number;
}

export interface Service {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  price_eur: number;
  duration_minutes: number;
  variants: Variant[];
  capacity: number;
  modes: LocationMode[];
  active: boolean;
  sort: number;
}

export interface Addon {
  id: string;
  business_id: string;
  name: string;
  price_eur: number;
  duration_minutes: number;
  active: boolean;
}

export interface OpeningHoursRow extends OpeningHours {
  id: string;
  business_id: string;
}

export interface TimeOffRow {
  id: string;
  business_id: string;
  staff_id: string | null;
  start_at: string;
  end_at: string;
  reason: string | null;
}

export interface Booking {
  id: string;
  business_id: string;
  service_id: string | null;
  staff_id: string | null;
  service_name: string;
  variant_key: string | null;
  variant_label: string | null;
  addon_ids: string[];
  seats: number;
  location_type: LocationMode;
  client_address: string | null;
  distance_km: number | null;
  travel_fee_eur: number;
  total_price_eur: number;
  deposit_amount_eur: number;
  deposit_paid: boolean;
  stripe_checkout_session_id: string | null;
  client_user_id: string | null;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  client_notes: string | null;
  start_at: string;
  end_at: string;
  status: BookingStatus;
  cancelled_by: "client" | "business" | "system" | null;
  confirm_token: string;
  reminder_sent: boolean;
  risk_alert_sent: boolean;
  rebooking_sent: boolean;
  review_requested: boolean;
  source: "marketplace" | "direct" | "assistant";
  commission_eur: number;
  commission_invoiced: boolean;
  created_at: string;
}

export interface Review {
  id: string;
  business_id: string;
  booking_id: string;
  author_user_id: string | null;
  author_name: string;
  rating: number;
  comment: string | null;
  reply: string | null;
  created_at: string;
}

export interface CustomerProfile {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  default_address: string | null;
}

/** Ligne renvoyée par la RPC search_businesses. */
export interface SearchRow {
  id: string;
  slug: string;
  name: string;
  category: string;
  tagline: string | null;
  city: string | null;
  city_slug: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  modes: LocationMode[];
  cover_url: string | null;
  min_price_eur: number | null;
  rating_avg: number;
  rating_count: number;
  plan: Plan;
  distance_km: number | null;
  relevance: number;
  sponsored: boolean;
  total_count: number;
}

export type ProspectStatus = "new" | "disqualified" | "sent" | "replied" | "ooo_paused" | "converted" | "stopped" | "error";

export interface Prospect {
  id: string;
  name: string;
  category: string | null;
  website: string | null;
  email: string | null;
  city: string | null;
  country: string;
  phone: string | null;
  detected_booking_tool: string | null;
  status: ProspectStatus;
  followup_count: number;
  next_followup_at: string | null;
  last_contacted_at: string | null;
  created_at: string;
}

export type ThreadStatus = "open" | "ai_handled" | "escalated" | "stopped";

export interface EmailThread {
  id: string;
  contact_email: string;
  prospect_id: string | null;
  business_id: string | null;
  subject: string | null;
  status: ThreadStatus;
  ai_reply_count: number;
  last_message_id: string | null;
  references_chain: string | null;
  updated_at: string;
  created_at: string;
}

export interface EmailMessage {
  id: string;
  thread_id: string;
  direction: "outbound" | "inbound";
  from_email: string;
  to_email: string;
  message_id: string | null;
  in_reply_to: string | null;
  body_text: string | null;
  ai_intent: string | null;
  created_at: string;
}

export interface WaitlistEntry {
  id: string;
  business_id: string;
  service_id: string | null;
  user_id: string | null;
  name: string;
  email: string;
  date_from: string;
  date_to: string;
  notified_at: string | null;
  created_at: string;
}
