import TeamBadge from './TeamBadge';
import type { InjuryDesk, InjuryItem, InjuryPerson } from '@/lib/injuryAnalysis';

const SEV = ['minor', 'moderate', 'significant', 'critical'] as const;
const sevRank = (s: string) => { const i = SEV.indexOf(s as typeof SEV[number]); return i < 0 ? 1 : i + 1; };
const fmtUpdated = (u: string) => { const d = new Date(u); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET'; };
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return 'source'; } };
const gameLabel = (g: string) => g.replace('@', ' @ ');

function statusTone(status: string) {
  const s = status.toLowerCase();
  if (s.startsWith('out') || s.includes('projected out')) return 'bg-rose-900/80 text-rose-100';
  if (s.includes('questionable') || s.includes('uncertain') || s.includes('doubtful')) return 'bg-amber-900/80 text-amber-100';
  if (s.includes('probable')) return 'bg-emerald-900/80 text-emerald-100';
  return 'bg-slate-800 text-slate-200';
}
function confTone(c: string) {
  const s = c.toLowerCase();
  if (s.startsWith('high')) return 'bg-emerald-500';
  if (s.startsWith('medium-high') || s.startsWith('medium')) return 'bg-amber-400';
  return 'bg-rose-400';
}

function People({ title, emoji, rows }: { title: string; emoji: string; rows: InjuryPerson[] }) {
  if (!rows.length) return null;
  return <div className="mt-3 min-w-0">
    <div className="text-xs font-semibold text-slate-400 mb-1">{emoji} {title}</div>
    <ul className="flex flex-wrap gap-2">{rows.map(b => <li key={`${b.team}-${b.player}`} className="min-w-0 max-w-full rounded-xl border border-slate-700 bg-slate-950/70 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="font-semibold break-anywhere">{b.player}</span>{b.team && <TeamBadge code={b.team.toLowerCase()} name={b.team}/>}{b.position && <span className="text-[11px] text-slate-400">{b.position}</span>}</div>
      {b.why && <p className="text-xs text-slate-300 mt-1 break-anywhere">{b.why}</p>}
      {b.key_stat_with_without && <p className="text-xs text-emerald-200/90 mt-1 break-anywhere"><span className="text-slate-500">With / without · </span>{b.key_stat_with_without}</p>}
    </li>)}</ul>
  </div>;
}

function Card({ item }: { item: InjuryItem }) {
  const n = sevRank(item.severity);
  return <article id={item.id} className="card min-w-0 scroll-mt-16">
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <TeamBadge code={item.team.toLowerCase()} name={item.team} size="md"/>
      <h3 className="text-base font-bold break-anywhere">{item.player}</h3>
      {item.position && <span className="text-xs text-slate-400">{item.position}</span>}
      <span className="text-xs text-slate-500">{gameLabel(item.game)}</span>
    </div>
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold ${statusTone(item.status)}`}>{item.status || 'Status TBD'}</span>
      {!item.status_official && <span className="inline-flex items-center rounded-full border border-amber-400/70 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-amber-200">Unofficial</span>}
      {item.injury && <span className="text-sm text-slate-300 break-anywhere">{item.injury}</span>}
    </div>
    <div className="mt-3 min-w-0">
      <div className="flex items-center justify-between text-[11px] text-slate-400"><span>Severity</span><span className="capitalize text-slate-200">{item.severity || 'n/a'}</span></div>
      <div className="mt-1 flex gap-1" role="meter" aria-valuemin={1} aria-valuemax={4} aria-valuenow={n} aria-label={`Severity ${item.severity || 'unknown'}`}>
        {SEV.map((s, i) => <span key={s} className={`h-2 flex-1 rounded-full ${i < n ? (n >= 4 ? 'bg-rose-500' : n === 3 ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-slate-800'}`}/>)}
      </div>
    </div>
    {item.team_impact && <p className="text-sm text-slate-200 mt-3 break-anywhere">{item.team_impact}</p>}
    <People title="Who benefits" emoji="🟢" rows={item.beneficiaries}/>
    <People title="Opponent boost" emoji="⚡" rows={item.opponent_beneficiaries}/>
    {item.betting_angle && <div className="mt-3 rounded-xl border border-emerald-600/70 bg-emerald-950/40 px-3 py-2 min-w-0">
      <div className="text-xs font-bold text-emerald-300">🎯 Betting angle</div>
      <p className="text-sm text-emerald-50 mt-1 break-anywhere">{item.betting_angle}</p>
    </div>}
    {item.confidence && <p className="mt-3 flex items-start gap-2 text-xs text-slate-300 min-w-0"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${confTone(item.confidence)}`} aria-hidden="true"/><span className="break-anywhere"><span className="text-slate-500">Confidence · </span>{item.confidence}</span></p>}
    {item.sources.length > 0 && <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">{item.sources.map(u => <li key={u} className="min-w-0 max-w-full"><a href={u} target="_blank" rel="noopener noreferrer" className="text-[11px] break-anywhere">{host(u)}</a></li>)}</ul>}
  </article>;
}

export default function InjuryDeskView({ desk }: { desk: InjuryDesk }) {
  const when = fmtUpdated(desk.updated);
  const games = [...new Set(desk.injuries.map(i => i.game).filter(Boolean))];
  return <div className="min-w-0">
    <header className="card border-emerald-700/60 bg-gradient-to-br from-emerald-950/80 to-slate-900 min-w-0">
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">The injury desk</p>
      <h1 className="!mb-1 break-anywhere">🩺 Week {desk.week} injury report</h1>
      <p className="text-sm text-slate-300">{when ? `Updated ${when}` : 'Updated time coming with the next file drop.'} Public for everyone. Angles are research, not promises.</p>
    </header>

    {desk.headline_summary.length > 0 && <section className="mt-5 min-w-0">
      <h2 className="!mt-0">📣 Headlines</h2>
      <ul className="space-y-2">{desk.headline_summary.map(line => <li key={line} className="card !p-3 min-w-0 border-emerald-900 font-semibold text-sm break-anywhere">{line}</li>)}</ul>
    </section>}

    <section className="mt-6 min-w-0">
      <h2 className="!mt-0">🤕 The board</h2>
      {games.map(g => <div key={g} className="mt-4 min-w-0">
        <h3 className="text-sm font-bold text-emerald-300">{gameLabel(g)}</h3>
        <div className="mt-2 space-y-3">{desk.injuries.filter(i => i.game === g).map(item => <Card key={item.id} item={item}/>)}</div>
      </div>)}
      {!desk.injuries.length && <p className="card text-sm text-slate-400">No injuries in this file yet.</p>}
    </section>

    <section className="mt-8 min-w-0">
      <h2 className="!mt-0">🌶️ Kenzie&apos;s Picks</h2>
      <p className="text-sm text-slate-400 mb-3">Her favorite edges off this week&apos;s report. Flames are confidence, 1 to 5. Still just a hunch with homework attached.</p>
      <ul className="space-y-3">{desk.kenzie_picks.map(p => <li key={`${p.player}-${p.prop}`} className="card min-w-0 border-emerald-700/50">
        <div className="flex flex-wrap items-center gap-2">
          <TeamBadge code={p.team.toLowerCase()} name={p.team} size="md"/>
          <span className="font-bold break-anywhere">{p.player}</span>
          <span className={`ml-auto inline-flex items-center rounded-full px-3 py-1 text-xs font-black tracking-wide ${p.pick === 'under' ? 'bg-rose-600 text-white' : 'bg-emerald-500 text-slate-950'}`}>{p.pick === 'under' ? 'UNDER' : 'OVER'}</span>
        </div>
        <p className="mt-2 text-lg font-bold text-white break-anywhere">{p.prop}</p>
        <p className="mt-1 text-sm" aria-label={`Confidence ${p.confidence} of 5`}>
          {Array.from({ length: 5 }, (_, i) => <span key={i} aria-hidden="true">{i < p.confidence ? '🔥' : '☆'}</span>)}
          <span className="ml-2 text-xs text-slate-400">{p.confidence}/5</span>
        </p>
        <p className="mt-2 text-sm text-slate-200 break-anywhere">{p.reasoning}</p>
        <p className="mt-2 text-xs text-slate-400 break-anywhere">Tied to: {p.links.length ? p.links.map((l, i) => <span key={l.id}>{i > 0 && ' · '}<a href={`#${l.id}`} className="font-semibold">{l.label}</a></span>) : p.linked_injury || 'the report above'}</p>
      </li>)}</ul>
      {desk.kenzie_picks_note && <p className="text-xs text-slate-500 mt-3 break-anywhere">{desk.kenzie_picks_note}</p>}
    </section>
  </div>;
}
