// Pure dashboard facts. Game logs, streaks, and the injury desk only.
import { injuryId } from './injuryWhy.mjs';

export const SEASON_WEEKS = [1, 2, 3, 4, 5];
export const POSITIONS = ['QB', 'RB', 'WR/TE', 'DEF', 'K'];
const ROLE = { passing: 'QB', rushing: 'RB', receiving: 'WR/TE', defense: 'DEF', kicking: 'K', punting: 'P' };

/** 2026 regular-season windows. Game-log dates are "Sun 9/13" style. */
export function weekOf(date) {
  const m = /([A-Za-z]+)\s+(\d+)\/(\d+)/.exec(String(date || ''));
  if (!m) return null;
  const key = Number(m[2]) * 100 + Number(m[3]);
  if (key >= 909 && key <= 915) return 1;
  if (key >= 916 && key <= 922) return 2;
  if (key >= 923 && key <= 929) return 3;
  if (key >= 930 && key <= 1006) return 4;
  if (key >= 1007 && key <= 1013) return 5;
  if (key >= 1014 && key <= 1020) return 6;
  return null;
}

export const STATS_META = {
  passYds: { label: 'Pass Yds', line: 225, field: 'passYds', cats: ['passing'], groups: ['passing'], positions: ['QB'] },
  passTd: { label: 'Pass TD', line: 1, field: 'passTd', cats: ['passing'], groups: ['passing'], positions: ['QB'] },
  rushYds: { label: 'Rush Yds', line: 50, field: 'primYds', cats: ['rushing', 'passing'], groups: ['rushing'], positions: ['RB', 'QB'] },
  recYds: { label: 'Rec Yds', line: 50, field: 'primYds', cats: ['receiving'], groups: ['receiving'], positions: ['WR/TE'] },
  rec: { label: 'Receptions', line: 4, field: 'rec', cats: ['receiving', 'rushing'], groups: ['receiving'], positions: ['WR/TE', 'RB'] },
  tackles: { label: 'Tackles', line: 6, field: 'tackles', cats: ['defense'], groups: ['defense'], positions: ['DEF'] },
  fgm: { label: 'FG Made', line: 1, field: 'fgm', cats: ['kicking'], groups: ['kicking'], positions: ['K'] },
};
export const PRIMARY = { QB: 'passYds', RB: 'rushYds', 'WR/TE': 'recYds', DEF: 'tackles', K: 'fgm' };

const normName = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/['’.]/g, '').replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
function sameName(a, b) {
  const x = normName(a), y = normName(b);
  if (!x || !y) return false;
  return x === y || x.endsWith(' ' + y) || y.endsWith(' ' + x);
}
const firstSentence = (s) => {
  const t = String(s || '').trim();
  if (!t || /^n\/a/i.test(t)) return '';
  return t.split(/(?<=\.)\s/)[0];
};

export function compactPlayers(players) {
  const out = [];
  for (const p of players || []) {
    const pos = ROLE[p.cat];
    if (!pos || pos === 'P') continue;
    const keys = Object.keys(STATS_META).filter(k => STATS_META[k].positions.includes(pos));
    const v = {};
    for (const k of keys) v[k] = SEASON_WEEKS.map(() => null);
    let any = false;
    for (const g of p.games || []) {
      const w = weekOf(g.date);
      if (!w || w > SEASON_WEEKS.length) continue;
      for (const k of keys) {
        const meta = STATS_META[k];
        if (!meta.cats.includes(g.cat) || typeof g[meta.field] !== 'number') continue;
        const i = w - 1;
        v[k][i] = v[k][i] == null ? g[meta.field] : v[k][i] + g[meta.field];
        any = true;
      }
    }
    if (any) out.push({ slug: p.slug, name: p.name, team: p.team, pos, v });
  }
  return out;
}

export function compactStreaks(hot, posOf) {
  return (hot || []).map(r => ({
    slug: r.slug, name: r.name, team: r.team, pos: posOf.get(r.slug) || null,
    group: r.group, field: r.field, thr: r.thr, label: r.label,
    streak: r.streak, hits: r.hits, games: r.games,
    weeks: [...new Set((r.strip || []).slice(-r.streak).map(g => weekOf(g.d)).filter(Boolean))],
  }));
}

export function compactInjuries(desk, roster, games) {
  const people = roster || [];
  const findSlug = (name, team) => people.find(p => sameName(p.name, name) && (!team || !p.team || p.team.toUpperCase() === String(team).toUpperCase()))?.slug || '';
  return (desk?.injuries || []).map(item => {
    const exploited = (item.exploited_by || []).map(e => ({
      name: e.player, team: e.team, why: e.why || '', slug: findSlug(e.player, e.team), pos: people.find(p => sameName(p.name, e.player))?.pos || '',
    }));
    const code = String(item.game || '');
    const [away, home] = code.split('@');
    const g = (games || []).find(x => x.awayCode === String(away || '').toLowerCase() && x.homeCode === String(home || '').toLowerCase());
    return {
      id: item.id || injuryId(item.team, item.player),
      href: `/injuries#${item.id || injuryId(item.team, item.player)}`,
      team: item.team, player: item.player, position: item.position, status: item.status,
      role: firstSentence(item.coverage_role),
      game: code, matchup: g?.slug || '',
      exploited,
    };
  }).filter(i => i.player);
}

export function buildDashboard({ players, hot, desk, week }) {
  const roster = compactPlayers(players);
  const posOf = new Map(roster.map(p => [p.slug, p.pos]));
  return {
    weeks: SEASON_WEEKS,
    injuryWeek: desk?.week || week?.week || null,
    teams: [...new Set(roster.map(p => p.team))].sort(),
    players: roster,
    streaks: compactStreaks(hot, posOf),
    injuries: compactInjuries(desk, roster, week?.games || []),
  };
}

const statFor = (p, stat) => stat === 'primary' ? PRIMARY[p.pos] : stat;

function playedIn(series, weeks) {
  const out = [];
  for (const w of weeks) {
    const v = series?.[w - 1];
    if (v != null) out.push({ w, v });
  }
  return out;
}

function inFilter(p, f) {
  if (f.team !== 'all' && p.team !== f.team) return false;
  if (f.pos !== 'all' && p.pos !== f.pos) return false;
  return true;
}

/** Everything the board draws for one filter set. */
export function dashboardView(model, filters) {
  const f = { week: 'all', team: 'all', pos: 'all', stat: 'primary', ...filters };
  const weeks = f.week === 'all' ? model.weeks : [Number(f.week)];
  const focus = f.week === 'all' ? model.weeks[model.weeks.length - 1] : Number(f.week);
  const minGames = weeks.length >= 3 ? 3 : 1;
  const rows = [];
  let up = 0, down = 0, upName = '', downName = '', upFrom = null, upTo = null, downFrom = null, downTo = null, upPct = 0, downPct = 0;
  for (const p of model.players) {
    if (!inFilter(p, f)) continue;
    const key = statFor(p, f.stat);
    const meta = key && STATS_META[key];
    if (!meta || !meta.positions.includes(p.pos)) continue;
    const series = p.v[key];
    const played = playedIn(series, weeks);
    if (!played.length) continue;
    const hits = played.filter(x => x.v >= meta.line).length;
    rows.push({ slug: p.slug, name: p.name, team: p.team, pos: p.pos, key, label: meta.label, line: meta.line, hits, games: played.length, rate: hits / played.length, played });
    const now = series?.[focus - 1];
    const prev = series?.[focus - 2];
    if (now == null || prev == null) continue;
    const pct = prev === 0 ? (now === 0 ? 0 : 1) : (now - prev) / Math.abs(prev);
    if (pct > 0) {
      up++;
      if (pct > upPct) { upPct = pct; upName = p.name; upFrom = prev; upTo = now; }
    } else if (pct < 0) {
      down++;
      if (pct < downPct) { downPct = pct; downName = p.name; downFrom = prev; downTo = now; }
    }
  }
  const eligible = rows.filter(r => r.games >= minGames);
  const best = eligible.slice().sort((a, b) => b.rate - a.rate || b.games - a.games || b.hits - a.hits)[0] || null;
  const statKey = f.stat === 'primary' ? null : f.stat;
  const streaks = model.streaks.filter(st => {
    if (f.team !== 'all' && st.team !== f.team) return false;
    if (f.pos !== 'all' && st.pos !== f.pos) return false;
    if (f.week !== 'all' && !st.weeks.includes(Number(f.week))) return false;
    if (statKey) {
      const meta = STATS_META[statKey];
      if (!meta || st.field !== meta.field || !meta.groups.includes(st.group)) return false;
    } else if (st.pos && PRIMARY[st.pos]) {
      const meta = STATS_META[PRIMARY[st.pos]];
      if (st.field !== meta.field || !meta.groups.includes(st.group)) return false;
    }
    return true;
  });
  const seen = new Set();
  const streakRows = [];
  for (const st of streaks) {
    if (seen.has(st.slug)) continue;
    seen.add(st.slug);
    streakRows.push(st);
  }
  const lines = eligible.slice().sort((a, b) => b.rate - a.rate || b.games - a.games).slice(0, 5).map(r => {
    const p = model.players.find(x => x.slug === r.slug);
    const series = p?.v[r.key] || [];
    let h = 0, n = 0;
    const points = weeks.map(w => {
      const v = series[w - 1];
      if (v == null) return { week: `W${w}`, rate: null, v: null };
      n++; if (v >= r.line) h++;
      return { week: `W${w}`, rate: Math.round(h / n * 1000) / 10, v };
    });
    return { slug: r.slug, name: r.name, team: r.team, points };
  });
  const bars = eligible.slice().sort((a, b) => b.rate - a.rate || b.games - a.games).slice(0, 10).map(r => ({
    slug: r.slug, name: r.name, team: String(r.team || '').toUpperCase(), pos: r.pos,
    rate: Math.round(r.rate * 1000) / 10, hits: r.hits, games: r.games, label: `${r.line}+ ${r.label}`,
  }));
  const positions = f.pos === 'all'
    ? (f.stat === 'primary' ? POSITIONS : STATS_META[f.stat]?.positions || [])
    : [f.pos];
  const byTeam = new Map();
  for (const r of rows) {
    if (!positions.includes(r.pos)) continue;
    const cell = byTeam.get(r.team) || {};
    const c = cell[r.pos] || { hits: 0, games: 0, n: 0 };
    c.hits += r.hits; c.games += r.games; c.n++;
    cell[r.pos] = c;
    byTeam.set(r.team, cell);
  }
  const heatTeams = [...byTeam.entries()].map(([team, cell]) => {
    const cells = positions.map(pos => {
      const c = cell[pos];
      return { pos, n: c?.n || 0, rate: c && c.games ? c.hits / c.games : null };
    });
    const games = cells.reduce((a, c) => a + (cell[c.pos]?.games || 0), 0);
    const hits = cells.reduce((a, c) => a + (cell[c.pos]?.hits || 0), 0);
    return { team, cells, rate: games ? hits / games : 0 };
  }).sort((a, b) => b.rate - a.rate || a.team.localeCompare(b.team));
  const showInjuries = f.week === 'all' || Number(f.week) === model.injuryWeek;
  const injuries = showInjuries ? model.injuries.filter(item => {
    const teams = [item.team, ...item.exploited.map(e => e.team)].filter(Boolean).map(t => String(t).toLowerCase());
    if (f.team !== 'all' && !teams.includes(f.team)) return false;
    if (f.pos !== 'all') {
      const pos = item.exploited.map(e => e.pos);
      if (!pos.includes(f.pos)) return false;
    }
    return true;
  }) : [];
  return {
    minGames, focus, statLabel: f.stat === 'primary' ? 'each position\'s primary stat' : STATS_META[f.stat]?.label || f.stat,
    kpis: {
      streaks: seen.size,
      best: best ? { slug: best.slug, name: best.name, team: best.team, rate: Math.round(best.rate * 1000) / 10, hits: best.hits, games: best.games, label: `${best.line}+ ${best.label}` } : null,
      up, down, upName, downName, upFrom, upTo, downFrom, downTo,
    },
    lines, bars,
    heat: { positions, teams: heatTeams },
    streakRows: streakRows.slice(0, 8),
    injuries, injuryHidden: !showInjuries,
    players: rows.length,
  };
}
