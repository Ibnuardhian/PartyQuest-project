import { CLASSIC_MAX_PLAYERS, CLASSIC_MIN_PLAYERS, type Alignment, type ClassicRole, type OnuwRole } from "@/games/werewolf/contract";

/** Roster data from docs/02 §2.2. Descriptions are shown on role cards. */
export interface ClassicRoleInfo {
  name: string;
  alignment: Alignment;
  /** Maximum copies in one game. */
  max: number;
  /** Minimum copies when present at all (Mason works in pairs). */
  minWhenPresent: number;
  twist: boolean;
  description: string;
  artPrompt: string;
}

export const CLASSIC_ROLE_INFO: Record<ClassicRole, ClassicRoleInfo> = {
  WEREWOLF: { name: "Werewolf", alignment: "WEREWOLF", max: 4, minWhenPresent: 1, twist: false,
    description: "Kamu adalah pemangsa malam yang bersembunyi di balik wajah warga desa. Setiap malam, bangun bersama sesama Werewolf untuk memilih satu warga sebagai mangsa, lalu berbaurlah di siang hari agar identitasmu tidak terbongkar.",
    artPrompt: "Dark gothic tarot card illustration of a snarling shadow wolf standing under a crimson full moon, glowing amber eyes, minimal vector line art on deep obsidian background." },
  VILLAGER: { name: "Villager", alignment: "VILLAGER", max: CLASSIC_MAX_PLAYERS, minWhenPresent: 1, twist: false,
    description: "Kamu adalah warga desa biasa tanpa kekuatan khusus di malam hari, namun suara dan intuisi tajammu adalah senjata utama. Amati gerak-gerik mencurigakan saat diskusi siang dan temukan siapa Werewolf di antara kalian.",
    artPrompt: "Dark gothic tarot card illustration of a determined villager holding a flickering brass lantern in a misty medieval alley, gold and slate line art on obsidian background." },
  SEER: { name: "Seer", alignment: "VILLAGER", max: 1, minWhenPresent: 1, twist: false,
    description: "Kamu memiliki mata batin yang mampu menembus topeng kebohongan. Setiap malam, pilih satu pemain untuk menerawang apakah ia termasuk kubu Werewolf atau warga yang tidak bersalah.",
    artPrompt: "Dark gothic tarot card illustration of a mystical oracle gazing into a glowing cyan crystal ball with an all-seeing eye motif, fine line art on obsidian background." },
  DOCTOR: { name: "Doctor", alignment: "VILLAGER", max: 1, minWhenPresent: 1, twist: false,
    description: "Kamu adalah tabib desa yang sigap menyelamatkan nyawa di tengah kegelapan. Setiap malam, pilih satu pemain untuk dilindungi dari serangan Werewolf, namun kamu tidak boleh melindungi orang yang sama dua malam berturut-turut.",
    artPrompt: "Dark gothic tarot card illustration of a plague-era apothecary holding a glowing emerald healing vial and caduceus staff, fine line art on obsidian background." },
  HUNTER: { name: "Hunter", alignment: "VILLAGER", max: 1, minWhenPresent: 1, twist: false,
    description: "Kamu adalah pemburu ulung yang tidak pernah pergi tanpa perlawanan. Kapan pun kamu tereliminasi—baik dimangsa di malam hari maupun dieksekusi voting siang—kamu langsung menembak satu pemain lain untuk ikut mati bersamamu.",
    artPrompt: "Dark gothic tarot card illustration of a hooded ranger aiming a silver-tipped crossbow in dark woods, sharp bronze and white line art on obsidian background." },
  MASON: { name: "Mason", alignment: "VILLAGER", max: 3, minWhenPresent: 2, twist: false,
    description: "Kamu adalah anggota perkumpulan rahasia warga desa yang saling percaya sepenuhnya. Pada malam pertama, kamu akan melihat siapa saja rekan sesama Mason sehingga kalian bisa saling menjaga saat diskusi siang.",
    artPrompt: "Dark gothic tarot card illustration of two clasped gauntleted hands beneath a glowing geometric compass and square emblem, fine line art on obsidian background." },
  DISEASE: { name: "Disease", alignment: "VILLAGER", max: 1, minWhenPresent: 1, twist: false,
    description: "Tubuhmu membawa wabah misterius yang mematikan bagi para monster. Jika Werewolf memangsamu di malam hari, mereka akan tertular penyakitmu sehingga tidak mampu berburu atau membunuh siapa pun pada malam berikutnya.",
    artPrompt: "Dark gothic tarot card illustration of a cracked dark glass flask releasing bioluminescent violet spores into the night air, fine line art on obsidian background." },
  TANNER: { name: "Tanner", alignment: "INDEPENDENT", max: 1, minWhenPresent: 1, twist: true,
    description: "Kamu membenci hidupmu di desa ini dan hanya menginginkan akhir di tiang gantungan. Kamu tidak berpihak pada warga maupun Werewolf—jika warga mengeksekusimu lewat voting siang hari, kamulah pemenang tunggalnya.",
    artPrompt: "Dark gothic tarot card illustration of a melancholic jester holding a broken wooden mask beside a hangman's knot, muted ochre and crimson line art on obsidian background." },
  LYCAN: { name: "Lycan", alignment: "VILLAGER", max: 1, minWhenPresent: 1, twist: true,
    description: "Kamu adalah warga desa yang setia, namun darah kutukan mengalir samar di tubuhmu. Jika Seer menerawangmu di malam hari, aura gelapmu akan membuatmu terbaca sebagai Werewolf meskipun kamu berada di pihak warga.",
    artPrompt: "Dark gothic tarot card illustration of a human silhouette casting the shadow of a howling wolf against a pale moon, silver and indigo line art on obsidian background." },
  CURSED: { name: "Cursed", alignment: "VILLAGER", max: 1, minWhenPresent: 1, twist: true,
    description: "Awalnya kamu adalah warga biasa yang berjuang demi desa. Namun jika Werewolf memilihmu sebagai mangsa di malam hari, kamu tidak akan mati—melainkan bangkit dan berubah menjadi Werewolf baru pada malam berikutnya.",
    artPrompt: "Dark gothic tarot card illustration of a villager clutching their chest as glowing crimson claw marks transform them into a beast, fine line art on obsidian background." },
  WITCH: { name: "Witch", alignment: "VILLAGER", max: 1, minWhenPresent: 1, twist: true,
    description: "Kamu meracik dua ramuan kuno yang hanya bisa dipakai masing-masing satu kali sepanjang permainan: satu Ramuan Penyelamat untuk menghidupkan korban malam itu, dan satu Ramuan Racun untuk mengeliminasi satu pemain pilihanmu.",
    artPrompt: "Dark gothic tarot card illustration of a hooded witch holding a glowing green life elixir in one hand and a dark purple poison phial in the other, fine line art on obsidian background." },
  CUPID: { name: "Cupid", alignment: "VILLAGER", max: 1, minWhenPresent: 1, twist: true,
    description: "Pada malam pertama, kamu memanah dua pemain untuk saling jatuh cinta sehidup semati. Jika salah satu dari pasangan tersebut mati kapan pun dan dengan cara apa pun, pasangannya akan langsung ikut mati karena patah hati.",
    artPrompt: "Dark gothic tarot card illustration of two intertwined hearts pierced by a glowing rose-gold arrow, fine line art on obsidian background." },
  MINION: { name: "Minion", alignment: "WEREWOLF", max: 1, minWhenPresent: 1, twist: true,
    description: "Kamu adalah kaki tangan manusia yang mengabdi pada para Werewolf. Kamu mengetahui siapa saja Werewolf di desa ini, tetapi mereka tidak mengenalimu dan Seer akan melihatmu sebagai warga biasa—gunakan itu untuk mengacaukan voting.",
    artPrompt: "Dark gothic tarot card illustration of a cloaked cultist kneeling before shadowy wolf silhouettes with a concealed dagger, crimson and charcoal line art on obsidian background." },
  MAYOR: { name: "Mayor", alignment: "VILLAGER", max: 1, minWhenPresent: 1, twist: true,
    description: "Sebagai pemimpin tertinggi desa yang dihormati, suaramu memiliki bobot dua kali lipat setiap kali voting eksekusi berlangsung di siang hari. Gunakan pengaruh besarmu dengan bijak saat perdebatan memanas.",
    artPrompt: "Dark gothic tarot card illustration of an ornate golden seal ring and ceremonial gavel resting on a velvet ledger, gold line art on obsidian background." },
};

/**
 * Recommended composition (docs/02 §2.1). The spec's Villager ranges for 10–16 players do not
 * always add up to the player count, so remaining seats are filled with Villagers.
 */
export function recommendedComposition(playerCount: number): Partial<Record<ClassicRole, number>> {
  if (!Number.isInteger(playerCount) || playerCount < CLASSIC_MIN_PLAYERS || playerCount > CLASSIC_MAX_PLAYERS) {
    throw new Error(`Jumlah pemain harus ${CLASSIC_MIN_PLAYERS}–${CLASSIC_MAX_PLAYERS}.`);
  }
  const roles: Partial<Record<ClassicRole, number>> = { SEER: 1, DOCTOR: 1 };
  if (playerCount >= 6) roles.HUNTER = 1;
  if (playerCount === 8 || playerCount >= 10) roles.DISEASE = 1;
  if (playerCount >= 9) roles.MASON = 2;
  roles.WEREWOLF = playerCount <= 6 ? 1 : playerCount <= 11 ? 2 : playerCount <= 14 ? 3 : 4;
  const special = Object.values(roles).reduce((sum, count) => sum + (count ?? 0), 0);
  roles.VILLAGER = playerCount - special;
  return roles;
}

/** ONUW role descriptions (docs/02 §3.3). */
export const ONUW_ROLE_INFO: Record<OnuwRole, { name: string; description: string }> = {
  WEREWOLF: { name: "Werewolf", description: "Bangun di malam hari untuk mengenali sesama Werewolf. Jika hanya ada satu Werewolf yang bangun, kamu boleh mengintip satu kartu tertutup di tengah meja." },
  MINION: { name: "Minion", description: "Kamu berpihak pada Werewolf. Di malam hari kamu akan mengetahui siapa Werewolf-nya, sementara mereka tidak tahu siapa kamu—lindungi mereka agar tidak tertunjuk saat voting." },
  MASON: { name: "Mason", description: "Bangun di malam hari bersama rekan Mason lainnya untuk saling memastikan bahwa kalian berdua berada di kubu warga." },
  SEER: { name: "Seer", description: "Bangun di malam hari untuk mengintip kartu milik satu pemain lain, atau melihat dua kartu tertutup yang ada di tengah meja." },
  ROBBER: { name: "Robber", description: "Bangun di malam hari untuk menukar kartumu dengan kartu milik satu pemain lain, lalu lihat kartu barumu—peran barumu itulah yang berlaku sampai akhir permainan." },
  TROUBLEMAKER: { name: "Troublemaker", description: "Bangun di malam hari dan tukar posisi kartu milik dua pemain lain tanpa melihat isi kedua kartu tersebut." },
  DRUNK: { name: "Drunk", description: "Dalam keadaan mabuk berat, kamu menukar kartumu sendiri dengan salah satu kartu tertutup di tengah meja tanpa melihat peran barumu." },
  INSOMNIAC: { name: "Insomniac", description: "Bangun paling akhir sebelum pagi tiba untuk mengecek kartumu sendiri dan memastikan apakah posisimu sempat ditukar orang lain." },
  TANNER: { name: "Tanner", description: "Kamu menang sendirian jika berhasil memancing pemain lain menunjukmu saat voting siang hari." },
  HUNTER: { name: "Hunter", description: "Jika kamu mendapat suara terbanyak saat voting siang hari, orang yang kamu tunjuk juga ikut tereliminasi bersamamu." },
  VILLAGER: { name: "Villager", description: "Tidak bangun di malam hari; andalkan analisis percakapan di siang hari untuk menemukan siapa pemegang kartu Werewolf." },
};
