'use client'; import { useMe } from './useMe';
// Renders children only once we know the visitor is NOT signed in.
export default function SignedOut({children}:{children:React.ReactNode}){ const me=useMe(); return me&&!me.signedIn?<>{children}</>:null; }
