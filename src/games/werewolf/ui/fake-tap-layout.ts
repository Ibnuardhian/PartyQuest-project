/** Fake Tap layout (docs/03 §2.2): 3–4 numbered circles at random, non-overlapping positions. */

export interface TapTarget { number: number; x: number; y: number }

/** Positions are percentages of the play area; centers stay at least `minGap` apart and away from edges. */
export function makeTapSequence(random: () => number, minGap = 24): TapTarget[] {
  const count = random() < 0.5 ? 3 : 4;
  const targets: TapTarget[] = [];
  for (let attempt = 0; targets.length < count && attempt < 400; attempt += 1) {
    const x = 12 + random() * 76;
    const y = 14 + random() * 72;
    if (targets.every((target) => Math.hypot(target.x - x, target.y - y) >= minGap)) targets.push({ number: targets.length + 1, x, y });
  }
  return targets;
}
