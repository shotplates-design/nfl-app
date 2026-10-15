import TeamBadge from './TeamBadge';
import { pickIsFinal, type ExpertTake, type ExploitedBy, type InjuryDesk, type InjuryItem, type InjuryPerson, type KenziePick, type MatchupSpotlight } from '@/lib/injuryAnalysis';

const SEV = ['minor', 'moderate', 'significant', 'critical'] as const;
const sevRank = (s: string) => { const i = SEV.indexOf(s as typeof SEV[number]); return i < 0 ? 1 : i + 1; };
const fmtWhen = (u: string) => { const d = new Date(u); return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET'; };
const fmtDay = (u: string) => { if (/^\d{4}-\d{2}-\d{2}$/.test(u)) { const d = new Date(`${u}T12:00:00Z`); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }); } return fmtWhen(u) || u; };
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

function Sources({ urls }: { urls: string[] }) {
  if (!urls.length) return null;
  return <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1">{urls.map(u => <li key={u} className="min-w-0 max-w-full"><a href={u} target="_blank" rel="noopener noreferrer" className="text-[11px] break-anywhere">{host(u)}</a></li>)}</ul>;
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

function Exploit({ rows }: { rows: ExploitedBy[] }) {
  if (!rows.length) return null;
  return <div className="mt-3 min-w-0">
    <div className="text-xs font-semibold text-slate-400 mb-1">🎯 Who can exploit it</div>
    <ul className="flex flex-wrap gap-2">{rows.map(b => <li key={`${b.team}-${b.player}`} className="min-w-0 max-w-full rounded-xl border border-emerald-900 bg-slate-950/70 px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><span className="font-semibold break-anywhere">{b.player}</span>{b.team && <TeamBadge code={b.team.toLowerCase()} name={b.team}/>}</div>
      {b.why && <p className="text-xs text-slate-300 mt-1 break-anywhere">{b.why}</p>}
      {b.alignment_notes && <p className="text-xs text-slate-400 mt-1 break-anywhere">{b.alignment_notes}</p>}
    </li>)}</ul>
  </div>;
}

function Takes({ rows }: { rows: ExpertTake[] }) {
  if (!rows.length) return null;
  return <div className="mt-3 min-w-0">
    <div className="text-xs font-semibold text-slate-400 mb-1">🎙️ Expert takes</div>
    <ul className="space-y-2">{rows.map((t, i) => <li key={`${t.source_name}-${t.date}-${i}`} className="min-w-0 rounded-xl border border-slate-700 bg-slate-950/50 px-3 py-2">
      {t.quote_or_paraphrase && <blockquote className="text-sm text-slate-100 break-anywhere">{t.quote_or_paraphrase}</blockquote>}
      <p className="mt-1 text-[11px] text-slate-400 break-anywhere">
        {t.url ? <a href={t.url} target="_blank" rel="noopener noreferrer" className="font-semibold">{t.source_name || host(t.url)}</a> : <span className="font-semibold text-slate-300">{t.source_name}</span>}
        {t.author && <> · {t.author}</>}
        {t.date && <> · {fmtDay(t.date)}</>}
      </p>
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
    {item.coverage_role && <p className="mt-2 text-sm text-slate-300 break-anywhere"><span className="text-slate-500">Coverage role · </span>{item.coverage_role}</p>}
    <div className="mt-3 min-w-0">
      <div className="flex items-center justify-between text-[11px] text-slate-400"><span>Severity</span><span className="capitalize text-slate-200">{item.severity || 'n/a'}</span></div>
      <div className="mt-1 flex gap-1" role="meter" aria-valuemin={1} aria-valuemax={4} aria-valuenow={n} aria-label={`Severity ${item.severity || 'unknown'}`}>
        {SEV.map((s, i) => <span key={s} className={`h-2 flex-1 rounded-full ${i < n ? (n >= 4 ? 'bg-rose-500' : n === 3 ? 'bg-amber-400' : 'bg-emerald-500') : 'bg-slate-800'}`}/>)}
      </div>
    </div>
    {item.team_impact && <p className="text-sm text-slate-200 mt-3 break-anywhere">{item.team_impact}</p>}
    <People title="Who benefits" emoji="🟢" rows={item.beneficiaries}/>
    <People title="Opponent boost" emoji="⚡" rows={item.opponent_beneficiaries}/>
    <Exploit rows={item.exploited_by}/>
    {item.betting_angle && <div className="mt-3 rounded-xl border border-emerald-600/70 bg-emerald-950/40 px-3 py-2 min-w-0">
      <div className="text-xs font-bold text-emerald-300">🎯 Betting angle</div>
      <p className="text-sm text-emerald-50 mt-1 break-anywhere">{item.betting_angle}</p>
    </div>}
    {item.confidence && <p className="mt-3 flex items-start gap-2 text-xs text-slate-300 min-w-0"><span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${confTone(item.confidence)}`} aria-hidden="true"/><span className="break-anywhere"><span className="text-slate-500">Confidence · </span>{item.confidence}</span></p>}
    <Takes rows={item.expert_takes}/>
    <Sources urls={item.sources}/>
  </article>;
}

function Spotlight({ item }: { item: MatchupSpotlight }) {
  return <article className="card min-w-0 border-emerald-800/70">
    <p className="text-[11px] font-bold uppercase tracking-widest text-emerald-300">{gameLabel(item.game)}</p>
    <h3 className="text-base font-bold mt-1 break-anywhere">{item.title}</h3>
    {item.body && <p className="mt-2 text-sm text-slate-200 break-anywhere">{item.body}</p>}
    <Sources urls={item.sources}/>
  </article>;
}

function PickCard({ pick, now }: { pick: KenziePick; now: number }) {
  const final = pickIsFinal(pick.final_after, now);
  return <li data-pick-state={final ? 'final' : 'live'} className={`card min-w-0 ${final ? 'border-slate-600 opacity-80' : 'border-emerald-700/50'}`}>
    <div className="flex flex-wrap items-center gap-2">
      <TeamBadge code={pick.team.toLowerCase()} name={pick.team} size="md"/>
      <span className="font-bold break-anywhere">{pick.player}</span>
      {final && <span className="inline-flex items-center rounded-full bg-slate-700 px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-slate-100">Final</span>}
      <span className={`ml-auto inline-flex items-center rounded-full px-3 py-1 text-xs font-black tracking-wide ${pick.pick === 'under' ? 'bg-rose-600 text-white' : 'bg-emerald-500 text-slate-950'}`}>{pick.pick === 'under' ? 'UNDER' : 'OVER'}</span>
    </div>
    <p className="mt-2 text-lg font-bold text-white break-anywhere">{pick.prop}</p>
    <p className="mt-1 text-sm" aria-label={`Confidence ${pick.confidence} of 5`}>
      {Array.from({ length: 5 }, (_, i) => <span key={i} aria-hidden="true">{i < pick.confidence ? '🔥' : '☆'}</span>)}
      <span className="ml-2 text-xs text-slate-400">{pick.confidence}/5</span>
    </p>
    <p className="mt-2 text-sm text-slate-200 break-anywhere">{pick.reasoning}</p>
    <Sources urls={pick.sources}/>
    <p className="mt-2 text-xs text-slate-400 break-anywhere">Tied to: {pick.links.length ? pick.links.map((l, i) => <span key={l.id}>{i > 0 && ' · '}<a href={`#${l.id}`} className="font-semibold">{l.label}</a></span>) : pick.linked_injury || 'the report above'}</p>
  </li>;
}

export default function InjuryDeskView({ desk, now = Date.now() }: { desk: InjuryDesk; now?: number }) {
  const when = fmtWhen(desk.updated);
  const games = [...new Set(desk.injuries.map(i => i.game).filter(Boolean))];
  const lockTimes = [...new Set(desk.kenzie_picks.map(p => p.final_after).filter(Boolean))];
  const sharedLock = lockTimes.length === 1 ? lockTimes[0] : '';
  const lockLabel = sharedLock ? fmtWhen(sharedLock) : '';
  const allFinal = desk.kenzie_picks.length > 0 && desk.kenzie_picks.every(p => pickIsFinal(p.final_after, now));
  const slate = [...new Set(desk.kenzie_picks.flatMap(p => p.links.map(l => l.game)).filter(Boolean))];
  const slateLabel = slate.map(gameLabel).join(' · ');
  const spotGames = [...new Set(desk.matchup_spotlights.map(s => s.game).filter(Boolean))];
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

    {desk.matchup_spotlights.length > 0 && <section className="mt-6 min-w-0">
      <h2 className="!mt-0">🔦 Matchup spotlights</h2>
      {spotGames.map(g => <div key={g} className="mt-3 min-w-0 space-y-3">
        {desk.matchup_spotlights.filter(s => s.game === g).map(s => <Spotlight key={`${s.game}-${s.title}`} item={s}/>)}
      </div>)}
    </section>}

    <section className="mt-6 min-w-0">
      <h2 className="!mt-0">🤕 The board</h2>
      {games.map(g => <div key={g} className="mt-4 min-w-0">
        <h3 className="text-sm font-bold text-emerald-300">{gameLabel(g)}</h3>
        <div className="mt-2 space-y-3">{desk.injuries.filter(i => i.game === g).map(item => <Card key={item.id} item={item}/>)}</div>
      </div>)}
      {!desk.injuries.length && <p className="card text-sm text-slate-400">No injuries in this file yet.</p>}
    </section>

    <section className="mt-8 min-w-0" data-picks-state={allFinal ? 'final' : 'live'}>
      <h2 className="!mt-0">🌶️ Kenzie&apos;s Picks{allFinal ? ' · Final' : ''}</h2>
      <p className="text-sm text-slate-400 mb-3 break-anywhere">
        {allFinal && lockLabel ? `Final. These picks locked at ${lockLabel}.` : lockLabel ? `Live until ${lockLabel}.` : 'Her favorite edges off this week’s report.'}
        {slateLabel ? ` ${slateLabel}.` : ''} Flames are confidence, 1 to 5.
      </p>
      <ul className="space-y-3">{desk.kenzie_picks.map(p => <PickCard key={`${p.player}-${p.prop}`} pick={p} now={now}/>)}</ul>
      {desk.kenzie_picks_note && <p className="text-xs text-slate-500 mt-3 break-anywhere">{desk.kenzie_picks_note}</p>}
    </section>
  </div>;
}
