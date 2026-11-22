import type { Metadata } from "next";
import WerewolfTvStage from "@/games/werewolf/ui/tv-stage";

export const metadata: Metadata = { title: "Layar TV Werewolf — PartyQuest", robots: { index: false, follow: false } };

export default async function WerewolfTvStagePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <WerewolfTvStage code={code.toUpperCase()} />;
}
