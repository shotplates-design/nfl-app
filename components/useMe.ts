'use client'; import { useEffect, useState } from 'react';
export type Me={signedIn:boolean,member:boolean,free:boolean,subStatus:string|null,canManage:boolean,payments:boolean,admin?:boolean};
let cache:Promise<Me>|null=null;
export function useMe(){ const [me,setMe]=useState<Me|null>(null); useEffect(()=>{ cache??=fetch('/api/me').then(r=>r.json()).catch(()=>({signedIn:false,member:false} as Me)); cache.then(setMe); },[]); return me; }
