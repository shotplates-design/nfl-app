import Subscribe from './Subscribe';
export const metadata={title:'Subscribe – ThePlayerProps Membership',robots:{index:false}};
export default function P({searchParams}:{searchParams:{reason?:string}}){ return <>{searchParams?.reason==='limit'&&<p role="status" className="card max-w-sm mx-auto mb-3 text-center text-amber-200">You've used your 5 free player lookups. Subscribe for unlimited access.</p>}<Subscribe/></>; }
