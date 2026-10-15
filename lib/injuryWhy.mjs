// Short injury context for Best Props and Sleepers "why" lines. Pure so tests can call it without the app.
const nameKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/\s+/g, ' ').trim();
export function samePlayer(a, b) {
  const x = nameKey(a), y = nameKey(b);
  return !!x && x.length >= 4 && x === y;
}
export function injuryId(team, player) {
  const slug = `${team}-${player}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
  return `injury-${slug}`;
}
function tokens(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\b(jr|sr|ii|iii|iv)\b/g, '').split(/[\s-]+/).filter(p => p.length > 1);
}
function mentions(text, name) {
  const t = String(text || '').toLowerCase();
  const parts = tokens(name);
  if (!parts.length) return false;
  if (t.includes(parts.join(' ')) || t.includes(parts.join(''))) return true;
  const last = parts[parts.length - 1];
  if (last && last.length > 4 && t.includes(last)) return true;
  if (parts.length >= 3) {
    const initials = parts.map(p => p[0]).join('');
    if (new RegExp(`\\b${initials}\\b`, 'i').test(t)) return true;
  }
  return false;
}
function shortName(name) {
  const parts = tokens(name);
  if (parts.length >= 3) return parts.map(p => p[0]).join('').toUpperCase();
  const last = parts[parts.length - 1] || '';
  return last ? last.charAt(0).toUpperCase() + last.slice(1) : String(name || '');
}
function shortRole(item) {
  const role = String(item.coverage_role || '');
  if (/shadow|top outside|\bcb1\b/i.test(role)) return 'shadow corner';
  if (/middle|seam|robber|tight end|slot/i.test(role)) return 'middle coverage';
  if (!role || /^n\/a/i.test(role)) return '';
  const bit = role.split(/[.;]/)[0].trim();
  return bit.length > 28 ? '' : bit;
}
function isCoverage(item) {
  return /^(CB|S|DB|NB)$/i.test(item.position || '') && !/^n\/a/i.test(item.coverage_role || '');
}
function statusWord(status) {
  const s = String(status || '').trim();
  return /^out/i.test(s) ? 'out' : s.toLowerCase();
}
function firstSentence(s) {
  const t = String(s || '').trim();
  if (!t || /^n\/a/i.test(t)) return '';
  return t.split(/(?<=\.)\s/)[0];
}
function rank(h) {
  let s = 0;
  if (h.exploited) s += 4;
  if (h.bene) s += 2;
  if (/^out/i.test(h.item.status || '')) s += 3;
  if (isCoverage(h.item)) s += 2;
  if (/critical/i.test(h.item.severity || '')) s += 1;
  return s;
}
/** Facts for the why sentence, plus one linked line when this player is named on an injury. */
const teamOk = (listed, team) => !listed || !team || String(listed).toUpperCase() === String(team).toUpperCase();
export function injuryBlurb(desk, { name, team } = {}) {
  if (!desk || !name) return null;
  const hits = [];
  for (const item of desk.injuries || []) {
    const exploited = (item.exploited_by || []).find(e => samePlayer(e.player, name) && teamOk(e.team, team));
    const bene = [...(item.beneficiaries || []), ...(item.opponent_beneficiaries || [])].find(b => samePlayer(b.player, name) && teamOk(b.team, team));
    const self = samePlayer(item.player, name) && teamOk(item.team, team);
    if (exploited || bene || self) hits.push({ item, exploited, bene, self });
  }
  if (!hits.length) return null;
  hits.sort((a, b) => rank(b) - rank(a));
  const primary = hits[0];
  const item = primary.item;
  const role = shortRole(item);
  const head = `${item.team} ${item.position} ${item.player} ${statusWord(item.status)}${role ? ` (${role})` : ''}`;
  const who = shortName(name);
  const text = primary.self ? head : isCoverage(item) ? `${head} — ${who} draws softer coverage` : `${head} — ${who} benefits`;
  const parts = [];
  const roleBit = firstSentence(item.coverage_role);
  if (roleBit) parts.push(roleBit);
  if (primary.exploited?.why) parts.push(primary.exploited.why);
  else if (primary.bene?.why) parts.push(primary.bene.why);
  const take = (item.expert_takes || []).find(t => mentions(t.quote_or_paraphrase, name));
  if (take?.quote_or_paraphrase) parts.push(`${take.source_name}: “${take.quote_or_paraphrase}”`);
  const spot = (desk.matchup_spotlights || []).find(s => mentions(s.title, name) || mentions(s.body, name));
  const spotBit = spot ? firstSentence(spot.body) : '';
  if (spotBit) parts.push(spotBit);
  return { clause: parts.filter(Boolean).join(' '), note: { text, href: `/injuries#${injuryId(item.team, item.player)}` } };
}
