# Undercover narrator: "The Chaotic Jester" voice script

Status: **script only.** The audio files below are not generated or wired into the game yet.
Generation needs an ElevenLabs key in the runtime server env (`ELEVENLABS_API_KEY`, never `NEXT_PUBLIC_`, never committed).

## Voice profile

- Archetype: Chaotic Jester / mischievous trickster host
- Tone: expressive mid-to-high theatrical voice, sly playful cadence, dramatic pitch swings, sudden eerie whispers
- Model: ElevenLabs `eleven_v3` (audio tags supported)
- Stability 25-35%, clarity/similarity 75-80%, style exaggeration 60-75%

## Lines

| Theme | Output file | Script |
| --- | --- | --- |
| Time pressure ("Waktu kalian tersisa 10 detik") | `public/audio/undercover/jester_time_10s.mp3` | [giggles] Tick-tock, tick-tock! Waktu kalian tersisa... sepuluh detik! [gasps] Ayo, panik dong, panik! [playful] Siapa yang keringat dingin duluan sebelum bel berbunyi? |
| Voting countdown ("3... 2... 1 Voting") | `public/audio/undercover/jester_voting_countdown.mp3` | [inhales] Siapkan jari telunjuk kalian untuk drama pengkhianatan terbesar hari ini... [dramatic] Tiga... dua... satu... [laughs] Voting dimulai! Tunjuk tersangkanya! |
| Mr. White caught, last guess | `public/audio/undercover/jester_mr_white_guess.mp3` | [gasps] Ooh, kejutan manis! Kalian berhasil menangkap sang tamu tak diundang, Mr. White! [chuckles] Tapi jangan senang dulu... [whispers] Badut selalu punya trik terakhir. [playful] Mr. White, sebutkan kata rahasia mereka sekarang... atau tamat riwayatmu! |
| Vote resolved, game continues | `public/audio/undercover/jester_game_continues.mp3` | [sighs] Sayang sekali, satu korban sudah tumbang... [laughs] tapi pestanya belum selesai! [mischievous] Pengkhianat aslinya masih tertawa di antara kalian. Ayo, lanjutkan saling tuduhnya! |

## Hooks in the game

- 10 seconds left in the clue window: `jester_time_10s`
- Clue window ends, voting opens: `jester_voting_countdown`
- Eliminated player was Mr. White (guess step): `jester_mr_white_guess`
- Vote resolved without a winner: `jester_game_continues`

Rules from AGENTS.md apply when wiring: lines name no roles or words (these four do not), the TV/host device is the only narrator, and the Web Speech fallback stays.
