import { SITE } from '@/lib/data';
export default function robots(){ return {rules:[{userAgent:'*',allow:'/'}],sitemap:`${SITE}/sitemap.xml`,host:SITE}; }
