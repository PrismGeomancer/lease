export interface PunchCardProps {
  days: number;
  elapsed: number;
  breachDay?: number;
  compact?: boolean;
}

export function PunchCard({ days, elapsed, breachDay, compact }: PunchCardProps) {
  const n = compact ? 10 : days;
  const scale = compact ? days / 10 : 1;
  const cells = Array.from({ length: n }, (_, i) => {
    const day = Math.ceil((i + 1) * scale);
    if (breachDay !== undefined && day === Math.max(1, Math.ceil(breachDay))) return 'b';
    return day <= elapsed ? '1' : '0';
  });
  return (
    <div
      class={`punch${compact ? ' punch--compact' : ''}`}
      style={{ '--cols': Math.min(days, 15) } as Record<string, number>}
      role="img"
      aria-label={`Day ${Math.min(elapsed, days)} of ${days}${breachDay ? `, breach on day ${breachDay}` : ''}`}
    >
      {cells.map((p, i) => (
        <span key={i} class="punch__cell" data-p={p} />
      ))}
    </div>
  );
}
