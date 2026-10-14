import { ImageResponse } from 'next/og';
export const size={width:1200,height:630}; export const contentType='image/png'; export const alt='ThePlayerProps – NFL player props, streaks & hit rates';
export default function OG(){ return new ImageResponse(<div style={{display:'flex',flexDirection:'column',justifyContent:'center',width:'100%',height:'100%',background:'#020617',color:'white',padding:80}}>
 <div style={{display:'flex',alignItems:'center'}}><div style={{display:'flex',fontSize:110,fontWeight:800}}><span style={{color:'#e2e8f0',fontWeight:300}}>the</span><span style={{fontWeight:700}}>player</span><span style={{color:'#34d399',fontWeight:700}}>props</span></div></div>
 <div style={{fontSize:40,color:'#10b981',marginTop:36}}>NFL player props, streaks & hit rates from real game logs</div></div>,size); }
