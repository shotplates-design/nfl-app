import type { NextAuthOptions } from 'next-auth'; import Credentials from 'next-auth/providers/credentials'; import bcrypt from 'bcryptjs'; import { Redis } from '@upstash/redis';
// User store: Upstash Redis (free tier) via REST. Required env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, NEXTAUTH_SECRET (NEXTAUTH_URL optional on Vercel).
export const authConfigured = () => !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN && process.env.NEXTAUTH_SECRET);
export const redis = () => new Redis({ url: process.env.UPSTASH_REDIS_REST_URL!, token: process.env.UPSTASH_REDIS_REST_TOKEN! });
export const userKey = (email:string)=> `user:${email.trim().toLowerCase()}`;
export const authOptions: NextAuthOptions = {
  session:{ strategy:'jwt' }, pages:{ signIn:'/login' }, secret: process.env.NEXTAUTH_SECRET,
  providers:[ Credentials({ name:'Email', credentials:{ email:{label:'Email',type:'email'}, password:{label:'Password',type:'password'} },
    async authorize(c){ if(!authConfigured()||!c?.email||!c?.password) return null;
      const u = await redis().get<{email:string,name:string,hash:string}>(userKey(c.email)); if(!u) return null;
      return (await bcrypt.compare(c.password,u.hash)) ? { id:u.email, email:u.email, name:u.name } : null; } }) ],
};
