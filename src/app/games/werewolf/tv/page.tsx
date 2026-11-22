import type { Metadata } from "next";
import WerewolfTvPair from "@/games/werewolf/ui/tv-pair";

export const metadata: Metadata = { title: "Layar TV Werewolf — PartyQuest", robots: { index: false, follow: false } };

export default function WerewolfTvPairPage() {
  return <WerewolfTvPair />;
}
