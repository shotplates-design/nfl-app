import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { viewerIsMember } from '@/lib/viewer';
import { loadDashboard } from '@/lib/dashboardData';
import Gate from '@/components/Gate';
import BiDashboard from '@/components/BiDashboard';
import SignOut from '../SignOut';

export const metadata = { title: 'Dashboard', robots: { index: false } };
export const dynamic = 'force-dynamic';

function Preview() {
  return <div aria-hidden="true" className="blur-sm pointer-events-none select-none space-y-3">
    <div className="grid grid-cols-2 gap-3">{[0, 1, 2, 3].map(i => <div key={i} className="card h-24"/>)}</div>
    <div className="card h-64"/>
  </div>;
}

export default async function Dash() {
  const s = await getServerSession(authOptions);
  if (!s) redirect('/login');
  const member = await viewerIsMember();
  const model = member ? await loadDashboard() : null;
  return <>
    <div className="flex justify-end mb-1"><SignOut/></div>
    {member && model ? <BiDashboard model={model} name={s.user?.name}/> : <Gate label="The dashboard"><Preview/></Gate>}
  </>;
}
