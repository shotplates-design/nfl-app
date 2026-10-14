// One-time: creates the "BetStats Membership" product + $4.99/month price. Run: STRIPE_SECRET_KEY=sk_... node scripts/stripe-setup.mjs
// Then set STRIPE_PRICE_ID (printed), STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in Vercel env.
const k=process.env.STRIPE_SECRET_KEY; if(!k){ console.error('STRIPE_SECRET_KEY not set'); process.exit(1); }
const post=async(p,b)=>{ const r=await fetch('https://api.stripe.com/v1/'+p,{method:'POST',headers:{Authorization:'Bearer '+k,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(b)}); const j=await r.json(); if(!r.ok) throw new Error(j.error?.message); return j; };
const prod=await post('products',{name:'BetStats Membership'});
const price=await post('prices',{product:prod.id,unit_amount:'499',currency:'usd','recurring[interval]':'month'});
console.log('STRIPE_PRICE_ID='+price.id);
