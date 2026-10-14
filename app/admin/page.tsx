import { getServerSession } from 'next-auth'; import { notFound } from 'next/navigation'; import { authOptions, redis, authConfigured } from '@/lib/auth'; import { isAdmin } from '@/lib/member'; import AdminUsers from './AdminUsers';
export const metadata={title:'Admin',robots:{index:false,follow:false}}; export const dynamic='force-dynamic';
export default async function Admin(){ const s=await getServerSession(authOptions); if(!isAdmin(s?.user?.email)||!authConfigured()) notFound();
  const r=redis(); const keys:string[]=[]; let cur:any=0; do { const [n,k]=await r.scan(cur,{match:'user:*',count:500}); cur=n; keys.push(...(k as string[])); } while(String(cur)!=='0');
  const vals=keys.length?await r.mget<any[]>(...keys):[];
  const users=vals.filter(Boolean).map((u:any)=>({email:u.email,created:u.created||null,status:['active','trialing'].includes(u.subStatus)?'paid':u.free?'promo':'none',sub:u.subStatus||null})).sort((a,b)=>(b.created||0)-(a.created||0));
  return <><h1>Admin: users ({users.length})</h1><AdminUsers users={users} me={s!.user!.email!.toLowerCase()}/></>; }
