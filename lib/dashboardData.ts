import { players, allStreaks } from './data';
import { loadInjuryDesk } from './injuryAnalysis';
import { currentWeek } from './matchups';
import { buildDashboard } from './dashboard.mjs';

export function loadDashboard() {
  return buildDashboard({ players, hot: allStreaks().hot, desk: loadInjuryDesk(), week: currentWeek() });
}
