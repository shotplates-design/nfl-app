import { Crumbs, JsonLd } from '@/lib/ui';
import { SITE } from '@/lib/data';
import { loadInjuryDesk } from '@/lib/injuryAnalysis';
import InjuryDeskView from '@/components/InjuryDesk';

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'NFL Injury Desk & Kenzie’s Picks',
  description: 'This week’s NFL injury report: status, severity, who benefits, and Kenzie’s picks. Visible to everyone.',
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
      <p className="text-sm text-slate-400 break-anywhere">No file yet. Drop <span className="text-slate-200">data/week-N-injury-analysis.json</span> in and refresh.</p>
    </div>}
  </>;
}
