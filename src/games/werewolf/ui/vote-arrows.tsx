interface Seat { id: string; name: string; alive: boolean }
interface Vote { voterId: string; targetId: string | null; weight: number }

const SIZE = 680;
const CENTER = SIZE / 2;
const RADIUS = 250;
const NODE = 30;
const LABEL = (RADIUS + NODE + 26) / RADIUS;

/** Seat positions on a circle, first player at the top, clockwise. */
export function seatPositions(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2;
    return { x: CENTER + RADIUS * Math.cos(angle), y: CENTER + RADIUS * Math.sin(angle) };
  });
}

/**
 * Open-vote reveal for the TV (docs/03 §3): players sit on a circle and each vote draws an arrow from
 * voter to target. Purely visual; the voter → target list beside it stays the accessible version.
 */
export function VoteArrows({ players, votes }: { players: Seat[]; votes: Vote[] }) {
  const positions = seatPositions(players.length);
  const at = new Map(players.map((player, index) => [player.id, positions[index]!]));
  const received = new Map<string, number>();
  for (const vote of votes) if (vote.targetId) received.set(vote.targetId, (received.get(vote.targetId) ?? 0) + vote.weight);
  return <svg className="ww-vote-arrows" viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
    <defs>
      <marker id="ww-arrowhead" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0 0L10 5L0 10z" fill="currentColor" />
      </marker>
    </defs>
    {votes.map((vote, index) => {
      const from = at.get(vote.voterId);
      const to = vote.targetId ? at.get(vote.targetId) : undefined;
      if (!from || !to) return null;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy) || 1;
      // Start and stop at the node edges; bend slightly so opposite votes do not overlap.
      const sx = from.x + (dx / length) * NODE;
      const sy = from.y + (dy / length) * NODE;
      const ex = to.x - (dx / length) * (NODE + 4);
      const ey = to.y - (dy / length) * (NODE + 4);
      const cx = (sx + ex) / 2 - (dy / length) * 28;
      const cy = (sy + ey) / 2 + (dx / length) * 28;
      return <path key={vote.voterId} className="ww-vote-arrow" d={`M${sx.toFixed(1)} ${sy.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`}
        strokeWidth={vote.weight > 1 ? 4 : 2.5} markerEnd="url(#ww-arrowhead)" pathLength={1} style={{ animationDelay: `${index * 180}ms` }} />;
    })}
    {players.map((player, index) => {
      const { x, y } = positions[index]!;
      const count = received.get(player.id) ?? 0;
      return <g key={player.id} className={`ww-vote-seat${player.alive ? "" : " is-dead"}${count ? " is-target" : ""}`}>
        <circle cx={x} cy={y} r={NODE} />
        <text x={x} y={y + 6} textAnchor="middle">{player.name.slice(0, 1).toUpperCase()}</text>
        {/* Names sit outside the circle so arrows (which come from the inside) never cover them. */}
        <text className="ww-vote-name" x={CENTER + (x - CENTER) * LABEL} y={CENTER + (y - CENTER) * LABEL + 5} textAnchor="middle">{player.name.length > 12 ? `${player.name.slice(0, 11)}…` : player.name}</text>
        {count > 0 && <text className="ww-vote-count" x={x + NODE} y={y - NODE + 4} textAnchor="middle">{count}</text>}
      </g>;
    })}
  </svg>;
}
