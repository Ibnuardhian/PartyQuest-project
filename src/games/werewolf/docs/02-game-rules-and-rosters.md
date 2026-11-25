# 02 — Game Rules, State Machines & Complete Role Rosters

> **PartyQuest adaptation:** This file keeps the original Werewolf Hybrid spec wording. Stack references were mapped to the PartyQuest platform (guest cookie, PostgreSQL, SSE). See `04-architecture-and-platform-integration.md` for how each item is implemented.

## 1. Mode 1: Hybrid Classic Werewolf — State Machine & Rules

### 1.1 Game State Transitions
```text
LOBBY
  └─> ROLE_REVEAL (All players confirm "Siap")
        └─> NIGHT_INTRO (AI: "Malam telah tiba...")
              └─> NIGHT_TURN_<ROLE> (Fixed 15s per active role in priority order)
                    └─> DAWN_RESOLUTION (Calculate kills, protections, Disease, Cursed)
                          ├─> HUNTER_REVENGE (If Hunter died overnight; 15s target pick)
                          └─> WIN_CHECK ──(Win Met)──> GAME_OVER
                                └─(Continue)─> DAY_DISCUSSION (Countdown timer)
                                                  └─> OPEN_VOTING (Hidden picks -> Simultaneous reveal)
                                                        ├─(Tie on 1st vote)──> TIE_DEFENSE (30s) -> TIE_REVOTE
                                                        └─> EXECUTION_RESOLUTION
                                                              ├─> HUNTER_REVENGE (If Hunter executed)
                                                              └─> WIN_CHECK ──(Win Met)──> GAME_OVER
                                                                    └─(Continue)─> NIGHT_INTRO
```

### 1.2 Night Priority Order (Mode 1)
Each role present in the match gets a **fixed 15-second turn window** (server-managed timer loop) so pacing never leaks whether a role holder is alive or dead:
1. `CUPID` *(Night 1 only)* — Links 2 players as `Lovers`.
2. `MASON` *(Night 1 only)* — Masons see each other's names on screen.
3. `WEREWOLF` — Sees fellow Werewolves + live claw indicator of teammates' selected target (delivered through the room event stream and a view refetch). Majority/consensus locks target. *(Skipped if Werewolves are infected by `DISEASE` from the previous night).*
4. `DOCTOR` — Selects 1 alive player to protect from Werewolf attack tonight (cannot protect the same player two nights in a row).
5. `SEER` — Selects 1 alive player to inspect alignment (`WEREWOLF` vs `VILLAGER`).
6. `WITCH` — Sees tonight's Werewolf victim; may spend `HEAL_POTION` (1x/game) and/or `POISON_POTION` (1x/game) on another alive player.

*(Note: Eliminated players cannot act during any `NIGHT_TURN_<ROLE>` and do not participate in night Fake Taps. Only `Hunter` triggers a one-time `HUNTER_REVENGE` target selection immediately upon dying).*

### 1.3 AFK Role Reassignment & Penalty Rules
Triggered when the Host presses **`Paksa Lanjut`** during a stalled Night Turn or Voting Phase:
1. **If stalled during `NIGHT_TURN_<ROLE>`:**
   - Identify the unresponsive alive player(s) holding that active role.
   - Query all alive players in the server-side game state with role `VILLAGER` who are currently `ONLINE` and have `hasAfkPenalty === false`.
   - If an eligible `VILLAGER` exists:
     - Randomly select 1 `VILLAGER` and promote them to `<ROLE>` (preserving remaining potion/ability state).
     - Show an immediate silent UI banner in the promoted player's private view: *"Peranmu telah diperbarui menjadi [ROLE] karena pemain sebelumnya tidak aktif."*
     - Demote the AFK player to `VILLAGER` and set `hasAfkPenalty = true`.
   - Advance to the next Night Turn.
2. **AFK Penalty Enforcement:**
   - **Strike 1 (`hasAfkPenalty === true`):** Player loses their voting privilege (`canVote = false`) in the upcoming `OPEN_VOTING` phase. Their UI states: *"Hak voting kamu dicabut untuk putaran ini karena AFK."*
   - **Strike 2 (Still AFK / unresponsive in the next consecutive phase):** Player is **automatically eliminated** (`status = 'DEAD_AFK'`) at phase transition. **Crucial Rule:** This automatic AFK elimination **does NOT consume the Day's voting execution quota**—the village still conducts its normal Day Discussion and Open Voting.

### 1.4 Open Voting & Tie-Breaker Rules
- During `OPEN_VOTING`, alive eligible players tap 1 suspect (plus an optional `Abstain / Skip` option).
- While timer is running, the TV/player screens show **who has voted** (checkmark) without revealing **who they voted for**.
- Once all eligible players vote or timer expires, UI reveals the **Open Vote Matrix** simultaneously (e.g., `Andi -> Budi`, `Citra -> Budi`, `Budi -> Andi`).
- **Mayor Passive:** Votes cast by `MAYOR` count as `2` votes.
- **Tie-Breaker:**
  - If 2+ players tie for highest votes (`> 0`), enter `TIE_DEFENSE` (`30s` timer) where only tied candidates speak to defend themselves.
  - Enter `TIE_REVOTE` (`20s` timer) where all alive voters vote **only among the tied candidates**.
  - If `TIE_REVOTE` results in a tie again, **no execution occurs** and the game proceeds directly to `NIGHT_INTRO`.

### 1.5 Win Conditions (Mode 1)
- **Tanner Win (Immediate Override):** If `TANNER` is executed via Day Voting, `TANNER` wins immediately (solo victory).
- **Lovers Win (Sub-condition):** If `CUPID` linked 1 `WEREWOLF` and 1 `VILLAGER`-aligned player, and they are the final 2 survivors, the `Lovers` win together.
- **Villager Win:** All `WEREWOLF` players are eliminated (`aliveWerewolves === 0`).
- **Werewolf Win:** Number of alive `WEREWOLF` players $\ge$ number of alive non-Werewolf players (`aliveWerewolves >= aliveOthers`).

---

## 2. Mode 1 Complete Role Roster (Base + Twist Toggles)

### 2.1 Recommended Auto-Composition Matrix
| Players | Werewolf | Seer | Doctor | Hunter | Mason | Disease | Villager |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **5** | 1 | 1 | 1 | 0 | 0 | 0 | 2 |
| **6** | 1 | 1 | 1 | 1 | 0 | 0 | 2 |
| **7** | 2 | 1 | 1 | 1 | 0 | 0 | 2 |
| **8** | 2 | 1 | 1 | 1 | 0 | 1 | 2 |
| **9** | 2 | 1 | 1 | 1 | 2 | 0 | 2 |
| **10–12** | 2–3 | 1 | 1 | 1 | 2 | 1 | 3–4 |
| **13–16** | 3–4 | 1 | 1 | 1 | 2 | 1 | 5–7 |

### 2.2 Mode 1 Role Specifications & Card Descriptions

#### Base Roles (Enabled by Default)
1. **Werewolf** (`WEREWOLF` Team)
   - **Description (ID):** *"Kamu adalah pemangsa malam yang bersembunyi di balik wajah warga desa. Setiap malam, bangun bersama sesama Werewolf untuk memilih satu warga sebagai mangsa, lalu berbaurlah di siang hari agar identitasmu tidak terbongkar."*
   - **Card Art Prompt:** `Dark gothic tarot card illustration of a snarling shadow wolf standing under a crimson full moon, glowing amber eyes, minimal vector line art on deep obsidian background.`
2. **Villager** (`VILLAGER` Team)
   - **Description (ID):** *"Kamu adalah warga desa biasa tanpa kekuatan khusus di malam hari, namun suara dan intuisi tajammu adalah senjata utama. Amati gerak-gerik mencurigakan saat diskusi siang dan temukan siapa Werewolf di antara kalian."*
   - **Card Art Prompt:** `Dark gothic tarot card illustration of a determined villager holding a flickering brass lantern in a misty medieval alley, gold and slate line art on obsidian background.`
3. **Seer** (`VILLAGER` Team)
   - **Description (ID):** *"Kamu memiliki mata batin yang mampu menembus topeng kebohongan. Setiap malam, pilih satu pemain untuk menerawang apakah ia termasuk kubu Werewolf atau warga yang tidak bersalah."*
   - **Card Art Prompt:** `Dark gothic tarot card illustration of a mystical oracle gazing into a glowing cyan crystal ball with an all-seeing eye motif, fine line art on obsidian background.`
4. **Doctor** (`VILLAGER` Team)
   - **Description (ID):** *"Kamu adalah tabib desa yang sigap menyelamatkan nyawa di tengah kegelapan. Setiap malam, pilih satu pemain untuk dilindungi dari serangan Werewolf, namun kamu tidak boleh melindungi orang yang sama dua malam berturut-turut."*
   - **Card Art Prompt:** `Dark gothic tarot card illustration of a plague-era apothecary holding a glowing emerald healing vial and caduceus staff, fine line art on obsidian background.`
5. **Hunter** (`VILLAGER` Team)
   - **Description (ID):** *"Kamu adalah pemburu ulung yang tidak pernah pergi tanpa perlawanan. Kapan pun kamu tereliminasi—baik dimangsa di malam hari maupun dieksekusi voting siang—kamu langsung menembak satu pemain lain untuk ikut mati bersamamu."*
   - **Card Art Prompt:** `Dark gothic tarot card illustration of a hooded ranger aiming a silver-tipped crossbow in dark woods, sharp bronze and white line art on obsidian background.`
6. **Mason** (`VILLAGER` Team — Minimum 2)
   - **Description (ID):** *"Kamu adalah anggota perkumpulan rahasia warga desa yang saling percaya sepenuhnya. Pada malam pertama, kamu akan melihat siapa saja rekan sesama Mason sehingga kalian bisa saling menjaga saat diskusi siang."*
   - **Card Art Prompt:** `Dark gothic tarot card illustration of two clasped gauntleted hands beneath a glowing geometric compass and square emblem, fine line art on obsidian background.`
7. **Disease** (`VILLAGER` Team)
   - **Description (ID):** *"Tubuhmu membawa wabah misterius yang mematikan bagi para monster. Jika Werewolf memangsamu di malam hari, mereka akan tertular penyakitmu sehingga tidak mampu berburu atau membunuh siapa pun pada malam berikutnya."*
   - **Card Art Prompt:** `Dark gothic tarot card illustration of a cracked dark glass flask releasing bioluminescent violet spores into the night air, fine line art on obsidian background.`

#### Optional Twist Roles (Advanced mode only)
> **PartyQuest decision (2026-11-25):** the twist roles below (`TWIST_ROLES`) appear only when the host switches on **Advanced mode** (`advanced` room setting, off by default). With it off, a custom composition containing a twist role is rejected and AUTO uses only base roles. With it on, AUTO adds twist roles by priority (Witch, Mayor, Cupid, Lycan, Tanner, Cursed, Minion), at most `ceil(players / 4)` of them and always keeping at least one Villager (`recommendedAdvancedComposition`). These are the roles that change hidden information or win conditions: Tanner (own win), Cupid (Lovers win), Cursed (switches team), Witch (one-shot heal/poison), Minion (ally with false information), Lycan (misleads the Seer), Mayor (double vote). Disease stays base because the recommended matrix above uses it.
8. **Tanner** (`INDEPENDENT` Team)
   - **Description (ID):** *"Kamu membenci hidupmu di desa ini dan hanya menginginkan akhir di tiang gantungan. Kamu tidak berpihak pada warga maupun Werewolf—jika warga mengeksekusimu lewat voting siang hari, kamulah pemenang tunggalnya."*
   - **Card Art Prompt:** `Dark gothic tarot card illustration of a melancholic jester holding a broken wooden mask beside a hangman's knot, muted ochre and crimson line art on obsidian background.`
9. **Lycan** (`VILLAGER` Team)
   - **Description (ID):** *"Kamu adalah warga desa yang setia, namun darah kutukan mengalir samar di tubuhmu. Jika Seer menerawangmu di malam hari, aura gelapmu akan membuatmu terbaca sebagai Werewolf meskipun kamu berada di pihak warga."*
   - **Card Art Prompt:** `Dark gothic tarot card illustration of a human silhouette casting the shadow of a howling wolf against a pale moon, silver and indigo line art on obsidian background.`
10. **Cursed** (`VILLAGER` -> `WEREWOLF` Team)
    - **Description (ID):** *"Awalnya kamu adalah warga biasa yang berjuang demi desa. Namun jika Werewolf memilihmu sebagai mangsa di malam hari, kamu tidak akan mati—melainkan bangkit dan berubah menjadi Werewolf baru pada malam berikutnya."*
    - **Card Art Prompt:** `Dark gothic tarot card illustration of a villager clutching their chest as glowing crimson claw marks transform them into a beast, fine line art on obsidian background.`
11. **Witch** (`VILLAGER` Team)
    - **Description (ID):** *"Kamu meracik dua ramuan kuno yang hanya bisa dipakai masing-masing satu kali sepanjang permainan: satu Ramuan Penyelamat untuk menghidupkan korban malam itu, dan satu Ramuan Racun untuk mengeliminasi satu pemain pilihanmu."*
    - **Card Art Prompt:** `Dark gothic tarot card illustration of a hooded witch holding a glowing green life elixir in one hand and a dark purple poison phial in the other, fine line art on obsidian background.`
12. **Cupid** (`VILLAGER` / `LOVERS` Team)
    - **Description (ID):** *"Pada malam pertama, kamu memanah dua pemain untuk saling jatuh cinta sehidup semati. Jika salah satu dari pasangan tersebut mati kapan pun dan dengan cara apa pun, pasangannya akan langsung ikut mati karena patah hati."*
    - **Card Art Prompt:** `Dark gothic tarot card illustration of two intertwined hearts pierced by a glowing rose-gold arrow, fine line art on obsidian background.`
13. **Minion** (`WEREWOLF` Team)
    - **Description (ID):** *"Kamu adalah kaki tangan manusia yang mengabdi pada para Werewolf. Kamu mengetahui siapa saja Werewolf di desa ini, tetapi mereka tidak mengenalimu dan Seer akan melihatmu sebagai warga biasa—gunakan itu untuk mengacaukan voting."*
    - **Card Art Prompt:** `Dark gothic tarot card illustration of a cloaked cultist kneeling before shadowy wolf silhouettes with a concealed dagger, crimson and charcoal line art on obsidian background.`
14. **Mayor** (`VILLAGER` Team)
    - **Description (ID):** *"Sebagai pemimpin tertinggi desa yang dihormati, suaramu memiliki bobot dua kali lipat setiap kali voting eksekusi berlangsung di siang hari. Gunakan pengaruh besarmu dengan bijak saat perdebatan memanas."*
    - **Card Art Prompt:** `Dark gothic tarot card illustration of an ornate golden seal ring and ceremonial gavel resting on a velvet ledger, gold line art on obsidian background.`

---

## 3. Mode 2: One Night Ultimate Werewolf (ONUW) — Rules & Roster

### 3.1 Deck Validation & Anti-Cheat Rules
- Total physical cards = `N + 3` (`N` dealt to players, `3` placed face-down in center).
- Let $D(r)$ be the count of role $r$ configured by the Host in the deck, and $S(r)$ be the count of role $r$ selected by the $N$ players during pass-the-phone setup.
- **Validation Formula:** Valid if and only if:
  $$\sum_{r} S(r) = N \quad \text{AND} \quad \forall r,\; S(r) \le D(r)$$
- If invalid, display all roles where $S(r) > D(r)$, retain `players[]` nicknames, and loop back to the pass-the-phone role picker.

### 3.2 Strict ONUW Night Wake-Up Sequence (Voice-Only, 10–15s Pause Each)
Only roles included in the Host's $N + 3$ deck are spoken by the AI Moderator:
1. `WEREWOLF` (12s) — Wake up, look for other Werewolves. *(If lone wolf: may look at 1 center card).*
2. `MINION` (10s) — Wake up; Werewolves stick out their thumbs so Minion knows who they are.
3. `MASON` (10s) — Wake up and recognize fellow Masons.
4. `SEER` (14s) — Wake up and look at 1 other player's card OR 2 center cards.
5. `ROBBER` (14s) — Wake up, swap own card with 1 other player's card, and look at new card.
6. `TROUBLEMAKER` (14s) — Wake up and swap the cards of 2 other players without looking at them.
7. `DRUNK` (12s) — Wake up and swap own card with 1 center card without looking at it.
8. `INSOMNIAC` (10s) — Wake up and check own card to see if it was swapped.

### 3.3 Mode 2 Role Descriptions (Indonesian)
- **Werewolf:** *"Bangun di malam hari untuk mengenali sesama Werewolf. Jika hanya ada satu Werewolf yang bangun, kamu boleh mengintip satu kartu tertutup di tengah meja."*
- **Minion:** *"Kamu berpihak pada Werewolf. Di malam hari kamu akan mengetahui siapa Werewolf-nya, sementara mereka tidak tahu siapa kamu—lindungi mereka agar tidak tertunjuk saat voting."*
- **Mason:** *"Bangun di malam hari bersama rekan Mason lainnya untuk saling memastikan bahwa kalian berdua berada di kubu warga."*
- **Seer:** *"Bangun di malam hari untuk mengintip kartu milik satu pemain lain, atau melihat dua kartu tertutup yang ada di tengah meja."*
- **Robber:** *"Bangun di malam hari untuk menukar kartumu dengan kartu milik satu pemain lain, lalu lihat kartu barumu—peran barumu itulah yang berlaku sampai akhir permainan."*
- **Troublemaker:** *"Bangun di malam hari dan tukar posisi kartu milik dua pemain lain tanpa melihat isi kedua kartu tersebut."*
- **Drunk:** *"Dalam keadaan mabuk berat, kamu menukar kartumu sendiri dengan salah satu kartu tertutup di tengah meja tanpa melihat peran barumu."*
- **Insomniac:** *"Bangun paling akhir sebelum pagi tiba untuk mengecek kartumu sendiri dan memastikan apakah posisimu sempat ditukar orang lain."*
- **Tanner:** *"Kamu menang sendirian jika berhasil memancing pemain lain menunjukmu saat voting siang hari."*
- **Hunter:** *"Jika kamu mendapat suara terbanyak saat voting siang hari, orang yang kamu tunjuk juga ikut tereliminasi bersamamu."*
- **Villager:** *"Tidak bangun di malam hari; andalkan analisis percakapan di siang hari untuk menemukan siapa pemegang kartu Werewolf."*


## Phase 8 role rules (implemented in the Classic engine, 2026-11-25)

Eleven roles were added to `CLASSIC_ROLES`. `APPRENTICE_SEER` is a base role; the other ten are twist roles, so they exist only when the room's Advanced mode is on. "Pack" means the Werewolf, Alpha Wolf, Wolf Cub, Dire Wolf, Dream Wolf, and Lone Wolf: pack members count as Werewolves for the win check and read as Werewolf to the Seer (the Lycan does too; the Minion and Sorcerer read as villagers). A composition needs at least one pack member who wakes and hunts (every pack role except the Dream Wolf), and the whole pack must be fewer than the other players.

| Role | Side | Rule |
|---|---|---|
| Apprentice Seer | Warga | Own night turn, always paced. Reads like the Seer, but only while no Seer is alive. |
| Prince | Warga | The first time he would die by execution (vote or Vampire doom) he survives and is revealed to everyone. The next one kills him. |
| Troublemaker | Warga | Once per game, during the first vote of a day (`second-vote`), he queues a second vote: after the first execution resolves, a fresh vote runs the same day. Independent of the ONUW Troublemaker. |
| Spellcaster | Warga | Night turn: silences one player. The name is public at dawn and the player may not speak that day (voting stays allowed). Cleared when the next night starts. |
| Vampire | Netral | Night turn: bites one player (Guardian Angel protection blocks it). The bitten player is public ("doomed") and is executed right after the next vote. The Werewolf attack cannot kill him. He wins when two players are alive, himself included (checked before the pack's parity win). Villagers win only when the pack and the Vampire are gone. |
| Lone Wolf | Jahat | Wakes with the pack. Wins alone when he is the only living pack member and the pack's count equals the other players; if other pack members live at that point, the pack wins and he loses. |
| Alpha Wolf | Jahat | In the Werewolf turn a switch converts the victim into a Werewolf (once per game). A protected or saved victim does not use it up. Never announced. |
| Sorcerer | Jahat | Own night turn every night: learns only whether a player is a Seer or Apprentice Seer. Not part of the pack. |
| Wolf Cub | Jahat | If he dies at any time, the pack picks two different victims on the following night (the Witch's potion saves the first). |
| Dire Wolf | Jahat | Night-1 turn: picks a secret partner. When the partner dies by any cause, the Dire Wolf dies at once (an ordinary death in public). |
| Dream Wolf | Jahat | Never wakes and has no turn; listed to the other pack members. Counts as a Werewolf. |

Night order: Cupid, Mason, Dire Wolf (night 1), Werewolves, Sorcerer, Guardian Angel, Seer, Apprentice Seer, Spellcaster, Vampire, Witch. Winner factions added: `LONE_WOLF`, `VAMPIRE`. Not yet built: the day UI for the Troublemaker's button and the silence/doom banners (tasks 8.7 and 8.9).
