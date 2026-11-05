import { Crumbs, JsonLd } from '@/lib/ui';
import { SITE } from '@/lib/data';
import { loadInjuryDesk } from '@/lib/injuryAnalysis';
import InjuryDeskView from '@/components/InjuryDesk';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'NFL Injury Desk & Injury Edges',
  description: 'This week’s NFL injury report from ESPN: status, severity, and automatic injury edges when a teammate is Out or Doubtful. Visible to everyone.',
  alternates: { canonical: '/injuries' },
};

export default function Page() {
  const desk = loadInjuryDesk();
  return <>
    <Crumbs items={[['Home', '/'], ['Injuries', '/injuries']]}/>
    {desk ? <>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'ItemList', name: `NFL Week ${desk.week} injury desk`, url: `${SITE}/injuries`, numberOfItems: desk.injuries.length }}/>
      <InjuryDeskView desk={desk}/>
    </> : <div className="card min-w-0">
      <h1>🩺 Injury desk</h1>
      <p className="text-sm text-slate-400 break-anywhere">No file yet. Drop <span className="text-slate-200">data/week-N-conditions.json</span> (auto) or <span className="text-slate-200">data/week-N-injury-analysis.json</span> (curated) and refresh.</p>
    </div>}
  </>;
}
