import type { Metadata } from "next";
import { notFound } from "next/navigation";
import VoicePilot from "@/games/werewolf/ui/voice-pilot";

// Same switch as the pilot TTS route: hidden in production unless WEREWOLF_VOICE_PILOT=1.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pilot Suara Werewolf — PartyQuest",
  robots: { index: false, follow: false },
};

export default function WerewolfVoicePilotPage() {
  if (process.env.NODE_ENV === "production" && process.env.WEREWOLF_VOICE_PILOT !== "1") notFound();
  return <VoicePilot />;
}
