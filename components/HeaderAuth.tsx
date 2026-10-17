'use client'; import Link from 'next/link'; import { useMe } from './useMe';
// Top-right header control: account button when signed in, Log in otherwise.
export default function HeaderAuth(){ const me=useMe(); if(!me) return <span className="ml-auto w-8"/>;
  if(me.signedIn) return <Link href="/account" aria-label="Your account" title="Account" className="ml-auto flex h-11 w-11 items-center justify-center rounded-full border border-slate-700 text-slate-200 hover:bg-slate-800 no-underline">
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg></Link>;
  return <Link href="/login" className="ml-auto whitespace-nowrap rounded-full border border-slate-700 px-3 py-1 text-slate-200">Log in</Link>; }
