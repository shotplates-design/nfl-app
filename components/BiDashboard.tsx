'use client';
import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { POSITIONS, STATS_META, dashboardView } from '@/lib/dashboard.mjs';

const COLORS = ['#34d399', '#38bdf8', '#fbbf24', '#c084fc', '#fb7185', '#22d3ee'];
const AXIS = { fill: '#94a3b8', fontSize: 11 };
const GRID = { stroke: '#1e293b' };

type Filters = { week: string; team: string; pos: string; stat: string };
const DEFAULTS: Filters = { week: 'all', team: 'all', pos: 'all', stat: 'primary' };

function tipStyle() {
  return { background: '#020617', border: '1px solid #334155', borderRadius: 8, fontSize: 12, color: '#e2e8f0' };
}
function heatColor(rate: number | null) {
  if (rate == null) return 'transparent';
  return `rgba(52, 211, 153, ${0.14 + Math.max(0, Math.min(1, rate)) * 0.82})`;
}
function go(router: ReturnType<typeof useRouter>, slug?: string) {
  if (slug) router.push(`/players/${slug}`);
}

function Controls({ model, f, set }: { model: any; f: Filters; set: (k: keyof Filters, v: string) => void }) {
  const weeks = model.weeks as number[];
  const teams = model.teams as string[];
  const sel = 'w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-2 text-sm text-slate-100';
  return <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
    <label className="text-xs text-slate-400">Week
      <select className={sel} value={f.week} onChange={e => set('week', e.target.value)}><option value="all">All weeks</option>{weeks.map(w => <option key={w} value={w}>Week {w}</option>)}{model.injuryWeek && !weeks.includes(model.injuryWeek) && <option value={model.injuryWeek}>Week {model.injuryWeek} (injuries)</option>}</select>
    </label>
    <label className="text-xs text-slate-400">Team
      <select className={sel} value={f.team} onChange={e => set('team', e.target.value)}><option value="all">All teams</option>{teams.map(t => <option key={t} value={t}>{String(t).toUpperCase()}</option>)}</select>
    </label>
    <label className="text-xs text-slate-400">Position
      <select className={sel} value={f.pos} onChange={e => set('pos', e.target.value)}><option value="all">All positions</option>{POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}</select>
    </label>
    <label className="text-xs text-slate-400">Stat
      <select className={sel} value={f.stat} onChange={e => set('stat', e.target.value)}><option value="primary">Primary stat</option>{Object.entries(STATS_META).map(([k, m]) => <option key={k} value={k}>{(m as any).label}</option>)}</select>
    </label>
  </div>;
}

function Kpi({ label, value, sub, href }: { label: string; value: string; sub: string; href?: string }) {
  const inner = <><p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p><p className="text-2xl font-semibold tabular-nums text-white mt-1">{value}</p><p className="text-xs text-slate-400 mt-1 break-anywhere">{sub}</p></>;
  return href
    ? <Link href={href} className="card min-w-0 no-underline hover:border-emerald-700">{inner}</Link>
    : <div className="card min-w-0">{inner}</div>;
}

export default function BiDashboard({ model, name }: { model: any; name?: string | null }) {
  const router = useRouter();
  const [f, setF] = useState<Filters>(DEFAULTS);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setReady(true); setMounted(true); }, []);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', onKey); };
  }, [open]);
  const view = useMemo(() => dashboardView(model, f), [model, f]);
  const set = (k: keyof Filters, v: string) => setF(prev => ({ ...prev, [k]: v }));
  const summary = `${f.week === 'all' ? 'All weeks' : `Week ${f.week}`} · ${f.team === 'all' ? 'All teams' : f.team.toUpperCase()} · ${f.pos === 'all' ? 'All positions' : f.pos} · ${f.stat === 'primary' ? 'Primary' : (STATS_META as any)[f.stat]?.label}`;
  const best = view.kpis.best;
  const chartH = 'h-72';
  return <div className="min-w-0">
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="min-w-0">
        <h1 className="!mb-1">Dashboard</h1>
        <p className="text-sm text-slate-400">Welcome{name ? `, ${name}` : ''}. Hit rates from this season&apos;s game logs{model.injuryWeek ? `, injury desk Week ${model.injuryWeek}` : ''}.</p>
      </div>
      <button type="button" className="md:hidden shrink-0 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm" onClick={() => setOpen(true)} aria-expanded={open}>Filters</button>
    </div>
    <div className="hidden md:block card mb-3"><Controls model={model} f={f} set={set}/><p className="text-xs text-slate-500 mt-2">{summary} · {view.players} players</p></div>
    {open && mounted && createPortal(<div className="fixed inset-0 z-[100] md:hidden">
      <button type="button" className="fixed inset-0 bg-slate-950/70" aria-label="Close filters" onClick={() => setOpen(false)}/>
      <div role="dialog" aria-modal="true" aria-label="Dashboard filters" className="fixed inset-x-0 bottom-0 max-h-[85vh] overflow-auto rounded-t-2xl border border-slate-700 bg-slate-900 p-4 pb-8">
        <div className="flex items-center justify-between mb-3"><p className="font-semibold text-white">Filters</p><button type="button" className="text-sm text-slate-400" onClick={() => setF(DEFAULTS)}>Reset</button></div>
        <Controls model={model} f={f} set={set}/>
        <button type="button" className="mt-4 w-full rounded-lg bg-emerald-600 py-2 font-semibold text-white" onClick={() => setOpen(false)}>Done</button>
      </div>
    </div>, document.body)}

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Kpi label="Active streaks" value={String(view.kpis.streaks)} sub={view.kpis.streaks ? 'Players still clearing a benchmark' : 'None in this filter'}/>
      <Kpi label="Best hit rate" value={best ? `${best.rate}%` : '—'} sub={best ? `${best.name} · ${best.hits}/${best.games} ${best.label}` : `Need ${view.minGames}+ games`} href={best ? `/players/${best.slug}` : undefined}/>
      <Kpi label="Trending up" value={String(view.kpis.up)} sub={view.kpis.upName ? `${view.kpis.upName} ${view.kpis.upTo} vs ${view.kpis.upFrom}` : `No prior week before ${view.focus}`}/>
      <Kpi label="Trending down" value={String(view.kpis.down)} sub={view.kpis.downName ? `${view.kpis.downName} ${view.kpis.downTo} vs ${view.kpis.downFrom}` : `No prior week before ${view.focus}`}/>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
      <section className="card min-w-0">
        <h2 className="!mt-0 text-sm">Hit-rate trend</h2>
        <p className="text-xs text-slate-500 mb-2">Rolling hit rate by week for the five highest rates on {view.statLabel}. Minimum {view.minGames} games.</p>
        {view.lines.length && view.lines[0].points.filter((p: any) => p.rate != null).length > 1 && ready ? <div className={chartH}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={view.lines[0].points.map((p: any, i: number) => {
              const row: any = { week: p.week };
              view.lines.forEach((line: any) => { row[line.slug] = line.points[i]?.rate ?? null; });
              return row;
            })} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid {...GRID}/>
              <XAxis dataKey="week" tick={AXIS} stroke="#334155"/>
              <YAxis domain={[0, 100]} tick={AXIS} stroke="#334155" unit="%"/>
              <Tooltip contentStyle={tipStyle()} formatter={(v: any, key: any) => [`${v}%`, view.lines.find((l: any) => l.slug === key)?.name || key]}/>
              {view.lines.map((line: any, i: number) => <Line key={line.slug} type="monotone" dataKey={line.slug} name={line.name} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={{ r: 3 }} connectNulls={false} activeDot={{ r: 5, onClick: () => go(router, line.slug) }}/>)}
            </LineChart>
          </ResponsiveContainer>
        </div> : <p className="text-sm text-slate-400 py-8">Pick a wider week range to draw a trend. One week is a single point.</p>}
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">{view.lines.map((line: any, i: number) => <li key={line.slug}><Link href={`/players/${line.slug}`} className="no-underline" style={{ color: COLORS[i % COLORS.length] }}>{line.name}</Link></li>)}</ul>
      </section>

      <section className="card min-w-0">
        <h2 className="!mt-0 text-sm">Top props by hit rate</h2>
        <p className="text-xs text-slate-500 mb-2">Share of games clearing the benchmark inside the selected weeks.</p>
        {view.bars.length && ready ? <div className={chartH}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart layout="vertical" data={view.bars} margin={{ top: 4, right: 12, left: 4, bottom: 0 }}>
              <CartesianGrid {...GRID} horizontal={false}/>
              <XAxis type="number" domain={[0, 100]} tick={AXIS} stroke="#334155" unit="%"/>
              <YAxis type="category" dataKey="name" width={104} tick={{ ...AXIS, fontSize: 10 }} stroke="#334155" tickFormatter={(s: string) => s.length > 14 ? s.slice(0, 13) + '…' : s}/>
              <Tooltip contentStyle={tipStyle()} formatter={(v: any, _k: any, item: any) => [`${v}% · ${item.payload.hits}/${item.payload.games} ${item.payload.label}`, item.payload.team]}/>
              <Bar dataKey="rate" radius={[0, 4, 4, 0]} cursor="pointer" onClick={(d: any) => go(router, d?.slug || d?.payload?.slug)}>
                {view.bars.map((b: any, i: number) => <Cell key={b.slug} fill={COLORS[i % COLORS.length]}/>)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div> : <p className="text-sm text-slate-400 py-8">No players have enough games in this filter.</p>}
        <ul className="mt-2 space-y-1 text-xs">{view.bars.slice(0, 5).map((b: any) => <li key={b.slug} className="flex justify-between gap-2 min-w-0"><Link href={`/players/${b.slug}`} className="truncate">{b.name}</Link><span className="text-slate-400 shrink-0">{b.hits}/{b.games} {b.label}</span></li>)}</ul>
      </section>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
      <section className="card min-w-0">
        <h2 className="!mt-0 text-sm">Team / position heatmap</h2>
        <p className="text-xs text-slate-500 mb-2">Average hit rate. Darker green is higher. A cell opens that team.</p>
        {view.heat.teams.length ? <div className="max-h-[420px] overflow-auto">
          <table className="!w-full text-xs">
            <thead><tr><th>Team</th>{view.heat.positions.map((p: string) => <th key={p}>{p}</th>)}</tr></thead>
            <tbody>{view.heat.teams.map((row: any) => <tr key={row.team}>
              <td><Link href={`/teams/${row.team}`}>{String(row.team).toUpperCase()}</Link></td>
              {row.cells.map((c: any) => <td key={c.pos} style={{ background: heatColor(c.rate) }} className="text-center">
                {c.rate == null ? <span className="text-slate-600">—</span> : <Link href={`/teams/${row.team}`} className="no-underline text-slate-100" title={`${String(row.team).toUpperCase()} ${c.pos}: ${Math.round(c.rate * 100)}% across ${c.n} players`}>{Math.round(c.rate * 100)}%</Link>}
              </td>)}
            </tr>)}</tbody>
          </table>
        </div> : <p className="text-sm text-slate-400">No team rates for this filter.</p>}
      </section>

      <section className="card min-w-0">
        <h2 className="!mt-0 text-sm">Injury impact</h2>
        {view.injuryHidden ? <p className="text-sm text-slate-400">No injury desk for this week. The file on disk is Week {model.injuryWeek}.</p> : view.injuries.length ? <ul className="max-h-[420px] overflow-auto space-y-3 pr-1">{view.injuries.map((item: any) => <li key={item.id} className="border-t border-slate-800 pt-2 first:border-0 first:pt-0">
          <p className="text-sm"><Link href={item.href}>{item.team} {item.position} {item.player}</Link> <span className="text-slate-400">{item.status}</span></p>
          {item.role && <p className="text-xs text-slate-500">{item.role}</p>}
          <ul className="mt-1 space-y-1">{item.exploited.map((e: any) => <li key={e.name} className="text-xs text-slate-300"><span className="text-slate-500">{e.team} </span>{e.slug ? <Link href={`/players/${e.slug}`}>{e.name}</Link> : e.name}{e.why ? ` — ${e.why}` : ''}</li>)}</ul>
          {item.matchup && <p className="text-xs mt-1"><Link href={`/matchups/${item.matchup}`}>Matchup</Link></p>}
        </li>)}</ul> : <p className="text-sm text-slate-400">No injuries match this team and position.</p>}
      </section>
    </div>

    <section className="card min-w-0 mt-3 overflow-x-auto">
      <h2 className="!mt-0 text-sm">Active streak board</h2>
      <p className="text-xs text-slate-500 mb-2">One benchmark streak per player inside the filter. Thresholds are statistical benchmarks, not sportsbook lines.</p>
      {view.streakRows.length ? <table>
        <thead><tr><th>Player</th><th>Team</th><th>Benchmark</th><th>Streak</th><th>Hit rate</th></tr></thead>
        <tbody>{view.streakRows.map((r: any) => <tr key={r.slug + r.label}><td><Link href={`/players/${r.slug}`}>{r.name}</Link></td><td><Link href={`/teams/${r.team}`}>{String(r.team).toUpperCase()}</Link></td><td>{r.label}</td><td className="text-emerald-400 font-semibold">{r.streak} straight</td><td>{r.hits}/{r.games}</td></tr>)}</tbody>
      </table> : <p className="text-sm text-slate-400">No active streaks in this filter.</p>}
    </section>
  </div>;
}
