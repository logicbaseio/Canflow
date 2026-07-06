import { chromium } from 'playwright-core';
import { readFileSync } from 'fs';
const EMAIL = readFileSync('/tmp/cf_rm.txt','utf8').trim(), PW='Test123!pass';
const S = process.env.SHOT;
try {
  const b = await chromium.launch({ channel:'chrome', headless:true, args:['--host-resolver-rules=MAP boards.canflow.app 64.29.17.65'] });
  const p = await b.newContext({ viewport:{width:1400,height:820} }).then(c=>c.newPage()); p.setDefaultTimeout(20000);
  let token=null;
  p.on('request', r=>{const a=r.headers()['authorization']; if(a&&a.startsWith('Bearer ')&&!token) token=a.slice(7);});
  await p.goto('https://boards.canflow.app/',{waitUntil:'domcontentloaded',timeout:30000}); await p.waitForTimeout(2500);
  await p.fill('input[type=email]',EMAIL); await p.fill('input[type=password]',PW);
  await p.locator('button[type=submit]').click(); await p.waitForTimeout(7000);
  await p.evaluate(async (token)=>{ await fetch('/api/boards',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({title:'Workmancer Roadmap',board_type:'roadmap'})}); }, token);
  await p.reload({waitUntil:'domcontentloaded'}); await p.waitForTimeout(3500);
  await p.getByText('Workmancer Roadmap', {exact:false}).first().click(); await p.waitForTimeout(2500);
  const info = await p.evaluate(()=>({ titleFull: document.body.innerText.includes('Workmancer Roadmap'), inviteBtn: document.body.innerText.includes('Invite') }));
  console.log('header shows full title:', info.titleFull, '| Invite button present:', info.inviteBtn);
  await p.screenshot({ path: S+'/rm-header.png' });
  await p.getByRole('button',{name:'Invite'}).first().click(); await p.waitForTimeout(1200);
  const modal = await p.evaluate(()=>({ modal: document.body.innerText.includes('Invite to a phase'), phaseSel: document.body.innerText.includes('Give access to phase') }));
  console.log('invite modal shows:', modal.modal, '| phase selector:', modal.phaseSel);
  await p.screenshot({ path: S+'/rm-invite.png' });
  await b.close();
} catch (e) { console.log('ERROR:', e.message); }
