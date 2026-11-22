import type { Metadata } from "next";
import VoicePilot from "@/games/werewolf/ui/voice-pilot";

export const metadata: Metadata = {
  title: "Pilot Suara Werewolf — PartyQuest",
  robots: { index: false, follow: false },
};

export default function WerewolfVoicePilotPage() {
  return <VoicePilot />;
}
