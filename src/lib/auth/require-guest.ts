import "server-only";
import { cookies } from "next/headers";
import { GUEST_COOKIE_NAME, getGuestSessionSecret, verifyGuestToken } from "@/lib/auth/guest-token";

/** Returns the guest proven by the signed HttpOnly cookie, or null. Never trusts a client-supplied id. */
export async function requireGuest() {
  try {
    const cookieStore = await cookies();
    const verified = verifyGuestToken(cookieStore.get(GUEST_COOKIE_NAME)?.value, getGuestSessionSecret());
    return verified ? { userId: verified.userId } : null;
  } catch {
    return null;
  }
}
