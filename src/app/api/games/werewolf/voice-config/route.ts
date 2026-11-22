import { apiSuccess } from "@/lib/api";
import { voiceConfig } from "@/games/werewolf/server/voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Which narrator voice and static pack the browser should use. Contains no secrets. */
export function GET() {
  return apiSuccess(voiceConfig());
}
