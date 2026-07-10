import { chromium } from 'playwright';
const out = '/tmp/claude-0/-home-user-my-blog-tool/8102d991-dfe4-5120-a26a-7e8f1c910751/scratchpad';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
let p = await b.newPage({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
await p.goto('http://localhost:3112/squad',{waitUntil:'networkidle'}); await p.waitForTimeout(600);
await p.screenshot({path:`${out}/squad-m.png`}); 
// open search modal
await p.locator('button.absolute').first().click(); await p.waitForTimeout(400);
await p.screenshot({path:`${out}/squad-modal.png`}); await p.close();
p = await b.newPage({ viewport:{width:1280,height:900} });
await p.goto('http://localhost:3112/squad',{waitUntil:'networkidle'}); await p.waitForTimeout(600);
await p.screenshot({path:`${out}/squad-d.png`}); await p.close();
await b.close(); console.log('done');
