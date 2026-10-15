import type { NextAuthOptions } from 'next-auth'; import Credentials from 'next-auth/providers/credentials'; import bcrypt from 'bcryptjs'; import { Redis } from '@upstash/redis';
// User store: Upstash Redis (free tier) via REST. Required env: UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN, NEXTAUTH_SECRET (NEXTAUTH_URL optional on Vercel).
// Accepts Upstash names or the Vercel Marketplace (KV_*) names.
const RURL = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const RTOK = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
export const authConfigured = () => !!(RURL() && RTOK() && process.env.NEXTAUTH_SECRET);
export const redis = () => new Redis({ url: RURL()!, token: RTOK()! });
export const userKey = (email:string)=> `user:${email.trim().toLowerCase()}`;
export const authOptions: NextAuthOptions = {
  session:{ strategy:'jwt' }, pages:{ signIn:'/login' }, secret: process.env.NEXTAUTH_SECRET,
  providers:[ Credentials({ name:'Email', credentials:{ email:{label:'Email',type:'email'}, password:{label:'Password',type:'password'} },
    async authorize(c){ if(!authConfigured()||!c?.email||!c?.password) return null;
      const u = await redis().get<{email:string,name:string,hash:string}>(userKey(c.email)); if(!u) return null;
      if(!(await bcrypt.compare(c.password,u.hash))) return null;
      const { saveFreeAccessPromo } = await import('@/lib/member'); await saveFreeAccessPromo(u.email);
      return { id:u.email, email:u.email, name:u.name }; } }) ],
};
