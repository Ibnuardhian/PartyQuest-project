import WerewolfSetup from "@/games/werewolf/ui/werewolf-setup";

// Read per request so WEREWOLF_VOICE_PILOT can be switched without a rebuild.
export const dynamic = "force-dynamic";

export default function WerewolfPage() {
  return <WerewolfSetup showVoicePilot={process.env.WEREWOLF_VOICE_PILOT === "1"} />;
}
