// Transactional email. Uses Resend if RESEND_API_KEY is set (EMAIL_FROM, e.g. "ThePlayerProps <noreply@theplayerprops.com>", domain verified in Resend),
// otherwise AgentMail if AGENTMAIL_API_KEY + AGENTMAIL_INBOX (inbox id/address) are set. Returns false if no provider is configured.
export const mailConfigured = () => !!(process.env.RESEND_API_KEY || (process.env.AGENTMAIL_API_KEY && process.env.AGENTMAIL_INBOX));
export async function sendMail(to:string, subject:string, text:string, html:string){
  if(process.env.RESEND_API_KEY){
    const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({from:process.env.EMAIL_FROM||'ThePlayerProps <onboarding@resend.dev>',to:[to],subject,text,html})});
    if(!r.ok) console.error('resend', r.status, await r.text()); return r.ok; }
  if(process.env.AGENTMAIL_API_KEY && process.env.AGENTMAIL_INBOX){
    const r=await fetch(`https://api.agentmail.to/v0/inboxes/${encodeURIComponent(process.env.AGENTMAIL_INBOX)}/messages/send`,{method:'POST',headers:{Authorization:`Bearer ${process.env.AGENTMAIL_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({to:[to],subject,text,html})});
    if(!r.ok) console.error('agentmail', r.status, await r.text()); return r.ok; }
  console.error('sendMail: no email provider configured'); return false; }
