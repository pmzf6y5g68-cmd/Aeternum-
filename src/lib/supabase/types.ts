import type { BookingStatus, OpeningHours } from "@/lib/domain/availability";
import type { LocationType, ServiceMode, SizePricingMap, VehicleSize } from "@/lib/domain/pricing";

export type Plan = "free" | "pro";

export interface Studio {
  id: string;
  owner_id: string;
  slug: string;
  name: string;
  email: string;
  phone: string | null;
  address: string | null;
  city: string | null;
  base_lat: number | null;
  base_lng: number | null;
  service_mode: ServiceMode;
  free_radius_km: number;
  max_radius_km: number;
  price_per_extra_km: number;
  travel_buffer_minutes: number;
  deposit_enabled: boolean;
  deposit_percent: number;
  plan: Plan;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_connect_account_id: string | null;
  stripe_connect_onboarded: boolean;
  rebooking_days: number;
  locale: "fr" | "en";
  created_at: string;
}

/** Colonnes exposables publiquement (tunnel client). */
export const PUBLIC_STUDIO_COLUMNS =
  "id, slug, name, phone, city, address, base_lat, base_lng, service_mode, free_radius_km, max_radius_km, price_per_extra_km, travel_buffer_minutes, deposit_enabled, deposit_percent, plan, stripe_connect_onboarded, locale" as const;

export type PublicStudio = Pick<
  Studio,
  | "id"
  | "slug"
  | "name"
  | "phone"
  | "city"
  | "address"
  | "base_lat"
  | "base_lng"
  | "service_mode"
  | "free_radius_km"
  | "max_radius_km"
  | "price_per_extra_km"
  | "travel_buffer_minutes"
  | "deposit_enabled"
  | "deposit_percent"
  | "plan"
  | "stripe_connect_onboarded"
  | "locale"
>;

export interface Service {
  id: string;
  studio_id: string;
  name: string;
  description: string | null;
  base_price_eur: number;
  base_duration_minutes: number;
  size_pricing_json: SizePricingMap;
  active: boolean;
}

export interface Addon {
  id: string;
  studio_id: string;
  name: string;
  price_eur: number;
  duration_minutes: number;
  active: boolean;
}

export interface OpeningHoursRow extends OpeningHours {
  id: string;
  studio_id: string;
}

export interface Booking {
  id: string;
  studio_id: string;
  service_id: string | null;
  addon_ids: string[];
  vehicle_size: VehicleSize;
  vehicle_model: string | null;
  location_type: LocationType;
  client_address: string | null;
  distance_km: number | null;
  travel_fee_eur: number;
  total_price_eur: number;
  deposit_amount_eur: number;
  deposit_paid: boolean;
  stripe_checkout_session_id: string | null;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  start_at: string;
  end_at: string;
  status: BookingStatus;
  confirm_token: string;
  reminder_sent: boolean;
  risk_alert_sent: boolean;
  rebooking_sent: boolean;
  created_at: string;
}

export type ProspectStatus = "new" | "disqualified" | "sent" | "replied" | "ooo_paused" | "converted" | "stopped" | "error";

export interface Prospect {
  id: string;
  name: string;
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
  studio_id: string | null;
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
