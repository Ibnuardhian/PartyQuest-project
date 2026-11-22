let guestCreation: Promise<void> | null = null;

async function createOrRenewGuest() {
  const response = await fetch("/api/guest/session", { method: "POST", cache: "no-store" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message ?? "Sesi tamu belum dapat dibuat.");
  }
}

/** Ensures the HttpOnly guest cookie exists. The browser never sees or sends the guest id itself. */
export function ensureBrowserGuest() {
  guestCreation ??= createOrRenewGuest().finally(() => { guestCreation = null; });
  return guestCreation;
}
