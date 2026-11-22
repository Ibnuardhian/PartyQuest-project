import { handleStartRound } from "@/lib/rooms/start-round";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  return handleStartRound("rematch", (await params).code);
}
