import { ImageResponse } from 'next/og';
export const size={width:1200,height:630}; export const contentType='image/png'; export const alt='BetStats NFL – player stats & streaks';
export default function OG(){ return new ImageResponse(<div style={{display:'flex',flexDirection:'column',justifyContent:'center',width:'100%',height:'100%',background:'#020617',color:'white',padding:80}}>
 <div style={{fontSize:80,fontWeight:800}}>🏈 BetStats NFL</div><div style={{fontSize:40,color:'#10b981',marginTop:20}}>Player stats, game logs & prop streaks for smarter bets</div></div>,size); }
