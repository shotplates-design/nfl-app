'use client'; import { signOut } from 'next-auth/react';
export default function SignOut(){ return <button onClick={()=>signOut({callbackUrl:'/'})} className="text-sm text-slate-400 underline">Sign out</button>; }
