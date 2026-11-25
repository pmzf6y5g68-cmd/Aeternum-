import { getCurrentUser } from "@/lib/supabase/server";
import type { CustomerProfile } from "@/lib/supabase/types";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const { supabase, user } = await getCurrentUser();
  if (!user) return null;
  const { data } = await supabase.from("customer_profiles").select("*").eq("user_id", user.id).maybeSingle<CustomerProfile>();
  return <ProfileForm defaults={{ full_name: data?.full_name ?? "", phone: data?.phone ?? "", default_address: data?.default_address ?? "" }} />;
}
