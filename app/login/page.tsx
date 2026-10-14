import { getServerSession } from 'next-auth'; import { redirect } from 'next/navigation'; import { authOptions } from '@/lib/auth';
import AuthForm from '../AuthForm';
export const metadata={title:'Log in',robots:{index:false}};
export default async function P(){ if(await getServerSession(authOptions)) redirect('/'); return <AuthForm mode="login"/>; }
