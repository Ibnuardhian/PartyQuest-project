import { cookies } from "next/headers";
import { apiError, apiSuccess } from "@/lib/api";
import { createGuestToken, getGuestSessionSecret, GUEST_COOKIE_NAME, GUEST_SESSION_MAX_AGE_SECONDS, verifyGuestToken } from "@/lib/auth/guest-token";
import { ensureGuestUser } from "@/lib/rooms/repository";

export const runtime = "nodejs";

/** Creates or renews the anonymous guest session. No email, password, or client-chosen id. */
export async function POST() {
  let secret: string;
  try {
    secret = getGuestSessionSecret();
  } catch {
    return apiError(503, "guest_unavailable", "Online Room belum dikonfigurasi (GUEST_SESSION_SECRET).");
  }
  try {
    const cookieStore = await cookies();
    const existing = verifyGuestToken(cookieStore.get(GUEST_COOKIE_NAME)?.value, secret);
    const userId = await ensureGuestUser(existing?.userId ?? null);
    cookieStore.set(GUEST_COOKIE_NAME, createGuestToken(userId, secret), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: GUEST_SESSION_MAX_AGE_SECONDS,
    });
    return apiSuccess({ ready: true });
  } catch {
    return apiError(503, "guest_unavailable", "Sesi tamu belum dapat dibuat. Periksa koneksi PostgreSQL.");
  }
}
