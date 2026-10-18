// Production gtag transport verification. Capture collect requests and return
// 204 locally; never send automated test events into the analytics property.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const page=await browser.newPage();const hits=[];
  await page.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.pathname.endsWith('/collect')){hits.push({url:req.url(),body:req.postData()});return route.fulfill({status:204});}
   if(['huxiago.com','www.googletagmanager.com'].includes(url.hostname))return route.continue();
   return route.fulfill({status:200,body:'',contentType:'text/javascript'});
  });
  await page.goto('https://huxiago.com/',{waitUntil:'load'});
  await page.waitForFunction(()=>window.huxiagoAnalytics?.ga4ScriptStatus==='loaded');
  await page.locator('.toc a[href="#spot-1"]').click();
  await page.waitForTimeout(700);
  await page.locator('#spot-1 .body p').filter({hasText:/.{30}/}).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(1500);
  await page.locator('#spot-1 > summary').click();await page.waitForTimeout(400);
  await page.locator('#spot-1 > summary').click();
  for(let n=0;n<20;n++){
   if(['toc_item_click','place_content_view','place_card_open'].every(name=>JSON.stringify(hits).includes(name)))break;
   await page.waitForTimeout(1000);
  }
  const parsed=hits.flatMap(hit=>{
   const base=new URL(hit.url).searchParams;
   return (hit.body?hit.body.split('\n'):['']).map(body=>new URLSearchParams([...base,...new URLSearchParams(body)]));
  });
  const wanted=['toc_item_click','place_card_open','place_content_view'];
  for(const name of wanted){
   const matches=parsed.filter(p=>p.get('en')===name);assert.equal(matches.length,1,name);
   const p=matches[0];assert.equal(p.get('tid'),'G-YZZEBJ9YBT');
   assert.equal(p.get('ep.place_id'),'spot-1');assert.equal(p.get('ep.episode'),'EP.01');
   assert.equal(p.get('ep.place_name'),'Central Park Bangkok');assert.equal(p.get('epn.position'),'1');
  }
  // Store only the event contract, omitting client/session identifiers.
  const evidence=parsed.filter(p=>wanted.includes(p.get('en'))).map(p=>Object.fromEntries([...p].filter(([k])=>['en','tid','ep.place_id','ep.place_name','ep.episode','epn.position'].includes(k))));
  fs.mkdirSync('test-results',{recursive:true});fs.writeFileSync('test-results/transport.json',JSON.stringify(evidence,null,2));
  console.log('PASS: real gtag serialized all three events correctly; collect intercepted before transmission.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
