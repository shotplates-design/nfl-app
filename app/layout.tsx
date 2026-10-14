import HeaderAuth from '@/components/HeaderAuth'; import MenuDrawer from '@/components/MenuDrawer';
import './globals.css'; import BottomNav from '@/components/BottomNav'; import Link from 'next/link'; import type { Metadata, Viewport } from 'next'; import { SITE, SITE_NAME } from '@/lib/data';
export const metadata: Metadata = { metadataBase:new URL(SITE), title:{default:`${SITE_NAME} – NFL Week Matchups, Player Prop Streaks & Hit Rates`,template:`%s | ${SITE_NAME}`},
  description:'Free NFL player stats, game logs, prop-benchmark streaks, hit rates and leaderboards to help bettors research props and matchups.',
  openGraph:{siteName:SITE_NAME,type:'website',locale:'en_US'}, twitter:{card:'summary_large_image'}, alternates:{canonical:'/'},
  appleWebApp:{capable:true,title:'ThePlayerProps',statusBarStyle:'black-translucent'}, icons:{icon:[{url:'/icon.svg',type:'image/svg+xml'},{url:'/favicon-32.png',sizes:'32x32',type:'image/png'}],apple:'/apple-touch-icon.png'} };
export const viewport: Viewport = { themeColor:'#020617', width:'device-width', initialScale:1 };
export default function Root({children}:{children:React.ReactNode}){ return <html lang="en"><body className="overflow-x-hidden">
  <header className="sticky top-0 z-10 bg-slate-950/90 backdrop-blur border-b border-slate-800"><nav className="max-w-5xl mx-auto px-4 h-12 flex items-center gap-4 text-sm">
    <MenuDrawer/><Link href="/" aria-label="ThePlayerProps home" className="flex items-center gap-1.5 whitespace-nowrap no-underline"><span className="tracking-tight"><span className="font-light text-slate-200">the</span><span className="font-bold text-white">player</span><span className="font-bold text-emerald-400">props</span></span></Link><div className="hidden md:flex items-center gap-4"><Link href="/matchups">Matchups</Link><Link href="/dashboard">Dashboard</Link><Link href="/players">Players</Link><Link href="/teams">Teams</Link><Link href="/streaks">Streaks</Link><Link href="/sleepers">Sleepers</Link><Link href="/leaders">Leaders</Link><Link href="/insights">Insights</Link><Link href="/watchlist">★ Watchlist</Link><Link href="/compare">Compare</Link></div><HeaderAuth/></nav></header>
  <main className="max-w-5xl mx-auto px-4 py-5 pb-24 md:pb-5">{children}</main>
  <footer className="max-w-5xl mx-auto px-4 py-8 text-xs text-slate-400 border-t border-slate-800 mt-10 space-y-2">
    <p><strong>Bet responsibly.</strong> Stats are informational only and do not guarantee outcomes. Must be 21+ (or legal age in your jurisdiction). If you or someone you know has a gambling problem, call or text <a href="tel:18004262537">1-800-GAMBLER</a> or visit <a href="https://www.ncpgambling.org" rel="nofollow noopener">ncpgambling.org</a>.</p>
    <p>Data: {new Date().getFullYear()} NFL season player data supplied to {SITE_NAME}. Not affiliated with the NFL.</p></footer>
  <BottomNav/>
</body></html>; }
