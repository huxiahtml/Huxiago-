// Run: node tests/ep01-tracking.cjs [--live]
// PLAYWRIGHT_MODULE may point to an installed Playwright package.
// All third-party requests are blocked: tests never pollute GA4 or Clarity.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const live=process.argv.includes('--live');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const out=process.env.TEST_OUTPUT||path.join(root,'test-results');
fs.mkdirSync(out,{recursive:true});
const expected=['Central Park Bangkok','Café Amazon Experience','Sala Lakorn','Liabduan Danneramit','神級海南雞飯','MuvMi','MK Restaurants','Som Tam Nua','Baan Ice','TrueCoffee','Swensen’s','FUFU Taiwanese Shabu'];
const results=[];
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
 for(const mobile of [false,true]){
  const label=mobile?'mobile':'desktop';
  const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname!=='huxiago.com')return route.fulfill({status:200,body:'',contentType:'text/javascript'});
   if(live)return route.continue();
   const file=path.join(root,decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
   if(!file.startsWith(root+path.sep)||!fs.existsSync(file))return route.fulfill({status:404,body:''});
   return route.fulfill({path:file});
  });
  const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const load=async()=>{await page.goto('https://huxiago.com/',{waitUntil:'load'});await page.waitForTimeout(800);};
  const events=()=>page.evaluate(()=>Array.from(window.dataLayer||[]).filter(x=>x[0]==='event').map(x=>({name:x[1],...x[2]})));
  const click=async selector=>{const el=page.locator(selector);if(mobile)await el.tap();else await el.click();};
  const count=async(name,id)=>(await events()).filter(e=>e.name===name&&e.place_id===id).length;
  await load();
  assert.equal(await page.locator('details.card[id^="spot-"]').count(),12);
  assert.equal(await page.locator('.toc a[href^="#spot-"]').count(),12);
  const names=await page.locator('details.card .head h3').allTextContents();
  assert.deepEqual(names,expected);
  assert.equal(await page.evaluate(()=>window.HUXIAGO_ANALYTICS_CONFIG.ga4MeasurementId),'G-YZZEBJ9YBT');
  assert.equal(await page.evaluate(()=>window.HUXIAGO_ANALYTICS_CONFIG.clarityProjectId),'yukhiquv1a');
  await page.screenshot({path:path.join(out,label+'-cover.png')});
  if(!process.argv.includes('--smoke')){
  for(let i=1;i<=12;i++){
   const id='spot-'+i;
   await click('.toc a[href="#'+id+'"]');
   await page.waitForTimeout(700);
   assert.equal(await count('toc_item_click',id),1);
   assert.equal(await count('place_card_open',id),0,'TOC must not count as direct open');
   const p=page.locator('#'+id+' .body p').filter({hasText:/.{30}/}).first();
   await p.scrollIntoViewIfNeeded();
   await page.waitForFunction(id=>Array.from(window.dataLayer||[]).some(x=>x[1]==='place_content_view'&&x[2].place_id===id),id,{timeout:6000});
   // Close, directly reopen, close and reopen again. Reading stays deduplicated.
   await click('#'+id+' > summary');await page.waitForTimeout(400);
   await click('#'+id+' > summary');await page.waitForTimeout(650);
   assert.equal(await count('place_card_open',id),1);
   await click('#'+id+' > summary');await page.waitForTimeout(400);
   assert.equal(await count('place_card_open',id),1,'Closing is not an open');
   await click('#'+id+' > summary');await page.waitForTimeout(650);
   await p.scrollIntoViewIfNeeded();await page.waitForTimeout(1300);
   assert.equal(await count('place_card_open',id),2);
   assert.equal(await count('place_content_view',id),1);
   const payloads=(await events()).filter(e=>['toc_item_click','place_card_open','place_content_view'].includes(e.name)&&e.place_id===id);
   for(const e of payloads){assert.equal(e.place_name,expected[i-1]);assert.equal(e.position,i);assert.equal(e.episode,'EP.01');assert.equal(e.send_to,'G-YZZEBJ9YBT');}
   results.push({device:label,place_id:id,place_name:expected[i-1],toc:1,direct:2,read:1});
   console.log(label+' '+id+' PASS');
  }
  assert.equal((await events()).filter(e=>e.name==='guide_open').length,0);
  // Repeated TOC selection, including an already-open destination.
  await click('.toc a[href="#spot-12"]');await page.waitForTimeout(650);
  assert.equal(await count('toc_item_click','spot-12'),2);
  assert.equal(await count('place_card_open','spot-12'),2);
  await page.screenshot({path:path.join(out,label+'-place.png')});
  fs.writeFileSync(path.join(out,label+'-events.json'),JSON.stringify(await events(),null,2));
  }
  // Programmatic opening / a brief glance must not count as a direct open or read.
  await load();
  await page.evaluate(()=>{window.huxDetailsMotion.open(document.getElementById('spot-1'));});
  await page.waitForTimeout(650);
  assert.equal(await count('place_card_open','spot-1'),0);
  await page.locator('#spot-1 .body p').filter({hasText:/.{30}/}).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await page.evaluate(()=>window.huxDetailsMotion.closeInstant(document.getElementById('spot-1')));
  await page.waitForTimeout(1300);
  assert.equal(await count('place_content_view','spot-1'),0,'Short glance must not count');
  // Hidden-document state resets dwell even when geometry remains visible.
  await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));window.huxDetailsMotion.open(document.getElementById('spot-1'));});
  await page.waitForTimeout(650);
  await page.locator('#spot-1 .body p').filter({hasText:/.{30}/}).first().scrollIntoViewIfNeeded();
  await page.waitForTimeout(1400);
  assert.equal(await count('place_content_view','spot-1'),0);
  await page.evaluate(()=>{delete document.visibilityState;document.dispatchEvent(new Event('visibilitychange'));});
  await page.locator('#spot-1 .body p').filter({hasText:/.{30}/}).first().scrollIntoViewIfNeeded();
  await page.waitForFunction(()=>Array.from(window.dataLayer||[]).some(x=>x[1]==='place_content_view'&&x[2].place_id==='spot-1'),null,{timeout:6000});
  // Names remain canonical after translation and across a persisted-English reload.
  await click('[data-hux-lang="en"]');
  await click('.toc a[href="#spot-5"]');await page.waitForTimeout(700);
  assert.equal((await events()).find(e=>e.name==='toc_item_click'&&e.place_id==='spot-5').place_name,expected[4]);
  await load();
  assert.equal(await page.locator('html').getAttribute('lang'),'en');
  if(mobile){await click('#spot-5 > summary');}else{
   await page.locator('#spot-5 > summary').focus();await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(650);
  assert.equal(await count('place_card_open','spot-5'),1);
  assert.equal((await events()).find(e=>e.name==='place_card_open'&&e.place_id==='spot-5').place_name,expected[4]);
  // Existing share panel and floating player still open and close.
  await click('.share-fab-toggle');assert.equal(await page.locator('.share-fab.open').count(),1);
  await page.keyboard.press('Escape');assert.equal(await page.locator('.share-fab.open').count(),0);
  const pip=page.locator('#spot-5 .reel-pip-launch').first();
  if(await pip.count()){
   await pip.click();assert.equal(await page.locator('.hux-reel-pip iframe').count(),1);
   const opened=(await events()).find(e=>e.name==='reel_open'&&e.reel_action==='inline_pip');
   assert.equal(opened.place_id,'spot-5');assert.equal(opened.episode,'EP.01');assert.equal(opened.place_name,expected[4]);
   await page.keyboard.press('Escape');assert.equal(await page.locator('.hux-reel-pip').count(),0);
  }
  const mapLinks=page.locator('details.card[id^="spot-"] a[href*="google.com/maps"],details.card[id^="spot-"] a[href*="maps.app.goo.gl"]');
  const mapCount=await mapLinks.count();assert.ok(mapCount>=10);
  await page.evaluate(()=>document.addEventListener('click',e=>{if(e.target.closest?.('a[href*="google.com/maps"],a[href*="maps.app.goo.gl"],a.reel-origin,[data-share]')){e.preventDefault();e.stopPropagation();}},true));
  for(let i=0;i<mapCount;i++)await mapLinks.nth(i).evaluate(a=>a.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})));
  const mapEvents=(await events()).filter(e=>e.name==='map_click');
  assert.equal(mapEvents.length,mapCount);
  for(const e of mapEvents){assert.match(e.place_id,/^spot-\d+$/);assert.equal(e.place_name,expected[e.position-1]);assert.equal(e.episode,'EP.01');}
  await page.locator('[data-share]').first().evaluate(b=>b.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})));
  assert.equal((await events()).find(e=>e.name==='share').episode,'EP.01');
  await page.locator('#spot-1 .reel-origin').first().evaluate(a=>a.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true})));
  const original=(await events()).find(e=>e.name==='reel_open'&&e.reel_action==='original_link');
  assert.equal(original.place_id,'spot-1');assert.equal(original.place_name,expected[0]);assert.equal(original.episode,'EP.01');
  assert.ok(await page.locator('[data-get-guide]').first().getAttribute('href'));
  assert.deepEqual(errors,[]);
  await context.close();
 }
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({mode:live?'production':'local',results},null,2));
 console.log(process.argv.includes('--smoke')?'PASS: desktop/mobile negative, language, keyboard and UI checks':'PASS: all 24 device/place combinations plus negative, language, keyboard and UI checks');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
