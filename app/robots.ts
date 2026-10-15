import { SITE } from '@/lib/data';
export default function robots(){ return {rules:[{userAgent:'*',allow:['/','/props/'],disallow:['/api/','/account','/admin']}],sitemap:`${SITE}/sitemap.xml`,host:SITE}; }
