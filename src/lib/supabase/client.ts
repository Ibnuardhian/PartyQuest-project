"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  browserClient ??= (() => {
    const { url, key } = getSupabasePublicConfig();
    return createBrowserClient(url, key);
  })();
  return browserClient;
}
