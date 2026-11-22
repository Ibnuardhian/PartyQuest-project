import { createClient } from "@/lib/supabase/server";

export async function requireGuest() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getClaims();
    const claims = data?.claims;
    if (error || typeof claims?.sub !== "string" || claims.is_anonymous !== true) return null;
    return { userId: claims.sub, supabase };
  } catch {
    return null;
  }
}
