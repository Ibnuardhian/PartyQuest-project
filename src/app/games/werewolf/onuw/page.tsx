import type { Metadata } from "next";
import OnuwLocalGame from "@/games/werewolf/ui/onuw-local-game";

export const metadata: Metadata = { title: "Werewolf ONUW — PartyQuest" };

export default function OnuwPage() {
  return <OnuwLocalGame />;
}
