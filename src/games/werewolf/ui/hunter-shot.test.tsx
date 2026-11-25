import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HunterShot } from "@/games/werewolf/ui/hunter-shot";

const player = (id: string, name: string) => ({ id, name, alive: true, hasAfkPenalty: false, death: null, canVote: true }) as never;

describe("HunterShot", () => {
  it("lists the targets and keeps the shot button disabled until one is picked", () => {
    const html = renderToStaticMarkup(<HunterShot targets={[player("a", "Budi"), player("b", "Citra")]} busy={false} onShoot={async () => undefined} />);
    expect(html).toContain("Budi");
    expect(html).toContain("Citra");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Pilih target dulu<\/button>/);
    expect(html).toContain("Jika waktu habis, kamu tidak menembak siapa pun");
  });

  it("says so when nobody can be targeted", () => {
    const html = renderToStaticMarkup(<HunterShot targets={[]} busy={false} onShoot={async () => undefined} />);
    expect(html).toContain("Tidak ada target yang dapat dipilih.");
  });
});
