const { chromium }=require(process.env.HUX_PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), http=require('node:http');
const root=path.resolve(__dirname, "..");
const {pathToFileURL}=require('node:url');
const links=['https://esimconnect.com.tw/#/access/esimbuy?region=泰國&referencecode=HUXIAGO','https://www.tablecheck.com/en/kushiro-omakase-and-japanese-dining-bangkok/reserve/message?utm_source=huxiago'];
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname));if(!p.startsWith(root+path.sep)){res.writeHead(403);return res.end()}fs.readFile(p,(e,v)=>{if(e){res.writeHead(404);return res.end()}res.setHeader('Content-Type',p.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');res.end(v)})});
const affirm=async(page,locale)=>{const cards=page.locator('#deals [data-shared-deal]'); assert.equal(await cards.count(),2);assert.deepEqual(await cards.locator('a').evaluateAll(a=>a.map(x=>x.getAttribute('href'))),links);assert((await cards.nth(1).innerText()).includes(locale==='en'?'20% off':'8 折'))};
const railLayout = page => page.evaluate(() => {
  const rail = document.querySelector('.desktop-rail');
  return {
    display: getComputedStyle(rail).display,
    position: getComputedStyle(rail).position,
    width: rail.offsetWidth,
    column: document.querySelector('.wrap').getBoundingClientRect().left,
    mobileNav: getComputedStyle(document.querySelector('.pocket-nav')).display,
    destinations: [...rail.querySelectorAll('.rail-links a')].map(a => [a.hash, Boolean(document.getElementById(a.hash.slice(1)))]),
  };
});
const ticketStyles = page => page.locator('#deals .deal-track article').evaluateAll(cards => cards.map(card => ({
  key: card.dataset.sharedDeal || card.dataset.upcomingDeal,
  color: getComputedStyle(card).backgroundColor,
  icon: card.querySelector('.ticket-icon svg')?.innerHTML,
  hasAction: Boolean(card.querySelector('.ticket-cta')),
})));
const previewStyles = page => page.locator('#deals .deal-previews li').evaluateAll(previews => previews.map(preview => ({
  key: preview.dataset.upcomingDeal,
  palette: preview.classList.contains('deal-pink') ? 'pink' : preview.classList.contains('deal-blue') ? 'blue' : null,
  color: getComputedStyle(preview).backgroundColor,
  height: preview.getBoundingClientRect().height,
  icon: preview.querySelector('.ticket-icon svg')?.innerHTML,
  insideTrack: Boolean(preview.closest('.deal-track')),
  label: preview.querySelector('small')?.textContent,
  hasAction: Boolean(preview.querySelector('a, button')),
})));
async function verifyPreviews(page, lang) {
  const previews = await previewStyles(page);
  assert.deepEqual(previews.map(x=>[x.key,x.palette]), [['transport','pink'],['dining-experiences','blue']]);
  assert.equal(new Set(previews.map(x=>x.color)).size, 2);
  const label = {'zh-Hant':'即將推出','zh-Hans':'即将推出',en:'Coming soon'}[lang];
  assert(previews.every(x=>x.icon && x.label===label && x.height>0 && x.height<80 && !x.insideTrack && !x.hasAction), JSON.stringify({lang,previews}));
}
const widths = [390, 647, 768, 979, 980, 1440];

(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
const b=await chromium.launch({executablePath:process.env.HUX_CHROME_BIN,headless:true});
try{const p=await b.newPage({reducedMotion:'reduce'});const errors=[];
await p.addInitScript(() => { Object.defineProperty(navigator,'share',{value: payload => { window.testShare = payload; }}); });p.on('pageerror',e=>errors.push(String(e)));await p.route(/^https?:/,r=>r.request().url().startsWith(origin)?r.continue():r.abort());
for(const lang of ['zh-Hant','zh-Hans','en']){
await p.goto(origin+'/index.html?lang='+lang);
await p.waitForFunction(l=>document.documentElement.lang===l,lang);
await p.waitForFunction(l=>document.querySelector('#deals [data-shared-deal="kushiro"]').textContent.includes(l==='en'?'View Kushiro':l==='zh-Hans'?'查看 Kushiro':'看 Kushiro'),lang);
await affirm(p,lang);assert.equal(await p.locator('details.card').count(),12);
const tickets = await ticketStyles(p);
assert.deepEqual(tickets.map(x=>x.key), ['esim','kushiro']);
assert.deepEqual(tickets.map(x=>x.hasAction), [true,true]);
assert(tickets.every(x=>x.icon && x.color==='rgb(251, 121, 46)'));
assert.equal(new Set(tickets.map(x=>x.icon)).size, 2);
const reference = new Map();
for(const width of widths){await p.setViewportSize({width,height:900});reference.set(width,await railLayout(p));await verifyPreviews(p,lang);}
await p.locator('.episode-trigger').click();await p.locator('.ep02-link').click();
await p.waitForURL(u=>u.pathname==='/ep02-'+lang+'.html');await affirm(p,lang);
assert.equal(await p.locator('details.card').count(),7);
assert.equal(await p.locator('#saen-saep .story-heading').count(),5);
await p.locator('#kushiro summary').click();
assert.equal(await p.locator('#kushiro .gallery figure').count(),4);
assert(await p.locator('#kushiro .gallery').evaluate(el=>el.scrollWidth>el.clientWidth));
await p.locator('#hani-spa summary').click();
assert.equal(await p.locator('#hani-spa .gallery figure').count(),3);
for(const width of widths){
  await p.setViewportSize({width,height:900});
  assert.deepEqual(await railLayout(p), reference.get(width));
  await verifyPreviews(p,lang);
  assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth), 'page overflows at width '+width);
}
assert.deepEqual(await ticketStyles(p),tickets);
await p.locator('.rail-links a[href="#deals"]').click();
await p.waitForFunction(()=>document.querySelector('.rail-links .active')?.hash==='#deals');
await p.locator('.rail-links a[href="#share-strip"]').click();
await p.locator('#share-strip [data-share="native"]').evaluate(button=>button.click());
await p.waitForFunction(locale=>window.testShare?.url==='https://huxiago.com/ep02-'+locale+'.html',lang);
const railDownload=p.waitForEvent('download');
await p.locator('.rail-acquire').click();
assert.equal((await railDownload).suggestedFilename(),'HUXIAGO_Bangkok_EP02_'+lang+'.html');
const pending=p.waitForEvent('download');await p.locator('.acquire-button').click();const file=(await pending).suggestedFilename();assert.equal(file,'HUXIAGO_Bangkok_EP02_'+lang+'.html');
await p.locator('.episode-trigger').click();await p.locator('#episode-menu a').click();await p.waitForURL(u=>u.pathname==='/index.html'&&u.searchParams.get('lang')===lang);
const c=await b.newContext({offline:true,viewport:{width:1440,height:900}});const q=await c.newPage();let offlineRail;
for(const name of [lang==='zh-Hant'?fs.readdirSync(root).find(n=>n.endsWith('vol01.html')):'HUXIAGO_Bangkok_EP01_'+lang+'.html',file]){
await q.goto(pathToFileURL(path.join(root,name)).href);await affirm(q,lang);
assert.deepEqual(await ticketStyles(q),tickets);
await verifyPreviews(q,lang);
if(name===file)assert.deepEqual(await railLayout(q),offlineRail);
else offlineRail=await railLayout(q);
if(name===file){await q.locator('#hani-spa summary').click();assert(await q.locator('#hani-spa figure img').first().evaluate(async el=>{await el.decode();return el.naturalWidth>0}));}
}await c.close();
}assert.deepEqual(errors,[]);console.log('Both issues and all six offline editions: matching rail and mobile layout, rail navigation and share, shared orange tickets and compact pink/blue previews, unchanged 12 EP.01 cards, seven EP.02 cards, galleries, transport story, two-way locale navigation, downloads and responsive widths verified.');
}finally{await b.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
