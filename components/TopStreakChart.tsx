import Link from 'next/link';

type Row = { slug: string; name: string; team: string; key: string; label: string; hits: number; games: number; streak: number };

/** Ranked top-10 chart. Same card + stacking table as the team pages, with a streak-length bar. */
export default function TopStreakChart({ rows }: { rows: Row[] }) {
  const max = Math.max(1, ...rows.map(r => Number(r.streak) || 0));
  return <div className="card overflow-x-auto max-w-full min-w-0">
    <table className="cards top10 w-full">
      <caption className="sr-only">Top 10 active streaks, ranked</caption>
      <thead><tr>
        <th scope="col" className="w-10">#</th>
        <th scope="col">Player</th>
        <th scope="col">Prop</th>
        <th scope="col">Hits</th>
        <th scope="col">Streak</th>
      </tr></thead>
      <tbody>{rows.map((r, i) => {
        const streak = Number(r.streak) || 0;
        const pct = Math.max(12, Math.round((streak / max) * 100));
        return <tr key={`${r.slug}-${r.key}`}>
          <td className="rank tabular-nums font-bold text-emerald-300" data-l="Rank">{i + 1}</td>
          <td className="who min-w-0" data-l="Player"><Link href={`/players/${r.slug}`} className="break-anywhere">{r.name}</Link> <span className="text-xs text-slate-500">{String(r.team || '').toUpperCase()}</span></td>
          <td data-l="Prop" className="font-medium break-anywhere">{r.label}</td>
          <td data-l="Hits" className="tabular-nums">{r.hits}/{r.games}</td>
          <td data-l="Streak">
            <span className="inline-flex items-center gap-2 min-w-0 max-w-full" aria-label={`${streak} game streak`}>
              <span className="h-2 w-24 max-w-full rounded bg-slate-800 overflow-hidden"><span className="block h-full grow-bar bg-emerald-500" style={{ ['--w' as any]: `${pct}%` }}/></span>
              <span className="tabular-nums font-semibold text-emerald-300 shrink-0">{streak}</span>
            </span>
          </td>
        </tr>;
      })}</tbody>
    </table>
  </div>;
}
