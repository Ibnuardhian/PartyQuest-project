import { createClient } from "@/lib/supabase/client";

let guestCreation: Promise<string> | null = null;

async function createOrReuseBrowserGuest() {
  const supabase = createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw new Error("Sesi tamu belum dapat diperiksa.");
  if (userData.user?.is_anonymous) return userData.user.id;
  if (userData.user) throw new Error("Gunakan sesi tamu untuk bergabung ke room.");
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) throw new Error("Sesi tamu belum dapat dibuat. Periksa pengaturan Supabase Auth.");
  return data.user.id;
}

export function ensureBrowserGuest() {
  guestCreation ??= createOrReuseBrowserGuest().finally(() => { guestCreation = null; });
  return guestCreation;
}

export async function saveGuestProfile(displayName: string) {
  const response = await fetch("/api/guest/ensure-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ displayName }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message ?? "Profil pemain belum dapat disimpan.");
  }
}
