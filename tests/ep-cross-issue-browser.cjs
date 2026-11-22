const { chromium }=require(process.env.HUX_PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), http=require('node:http');
const root=path.resolve(__dirname, "..");
const {pathToFileURL}=require('node:url');
const links=['https://esimconnect.com.tw/#/access/esimbuy?region=泰國&referencecode=HUXIAGO','https://www.tablecheck.com/en/kushiro-omakase-and-japanese-dining-bangkok/reserve/message?utm_source=huxiago'];
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname));if(!p.startsWith(root+path.sep)){res.writeHead(403);return res.end()}fs.readFile(p,(e,v)=>{if(e){res.writeHead(404);return res.end()}res.setHeader('Content-Type',p.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');res.end(v)})});
const affirm=async(page,locale)=>{const cards=page.locator('#deals [data-shared-deal]'); assert.equal(await cards.count(),2);assert.deepEqual(await cards.locator('a').evaluateAll(a=>a.map(x=>x.getAttribute('href'))),links);assert((await cards.nth(1).innerText()).includes(locale==='en'?'20% off':'8 折'))};
(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
const b=await chromium.launch({executablePath:process.env.HUX_CHROME_BIN,headless:true});
try{const p=await b.newPage();const errors=[];p.on('pageerror',e=>errors.push(String(e)));await p.route(/^https?:/,r=>r.request().url().startsWith(origin)?r.continue():r.abort());
for(const lang of ['zh-Hant','zh-Hans','en']){
await p.goto(origin+'/index.html?lang='+lang);
await p.waitForFunction(l=>document.documentElement.lang===l,lang);
await p.waitForFunction(l=>document.querySelector('#deals [data-shared-deal="kushiro"]').textContent.includes(l==='en'?'View Kushiro':l==='zh-Hans'?'查看 Kushiro':'看 Kushiro'),lang);
await affirm(p,lang);assert.equal(await p.locator('details.card').count(),12);
await p.locator('.episode-trigger').click();await p.locator('.ep02-link').click();
await p.waitForURL(u=>u.pathname==='/ep02-'+lang+'.html');await affirm(p,lang);
assert.equal(await p.locator('details.card').count(),7);
assert.equal(await p.locator('#saen-saep .story-heading').count(),5);
await p.locator('#kushiro summary').click();
assert.equal(await p.locator('#kushiro .gallery figure').count(),4);
assert(await p.locator('#kushiro .gallery').evaluate(el=>el.scrollWidth>el.clientWidth));
await p.locator('#hani-spa summary').click();
assert.equal(await p.locator('#hani-spa .gallery figure').count(),3);
for(const width of [390,768,1440]){await p.setViewportSize({width,height:900});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
const pending=p.waitForEvent('download');await p.locator('.acquire-button').click();const file=(await pending).suggestedFilename();assert.equal(file,'HUXIAGO_Bangkok_EP02_'+lang+'.html');
await p.locator('.episode-trigger').click();await p.locator('#episode-menu a').click();await p.waitForURL(u=>u.pathname==='/index.html'&&u.searchParams.get('lang')===lang);
const c=await b.newContext({offline:true});const q=await c.newPage();
for(const name of [file,lang==='zh-Hant'?fs.readdirSync(root).find(n=>n.endsWith('vol01.html')):'HUXIAGO_Bangkok_EP01_'+lang+'.html']){
await q.goto(pathToFileURL(path.join(root,name)).href);await affirm(q,lang);
if(name===file){await q.locator('#hani-spa summary').click();assert(await q.locator('#hani-spa figure img').first().evaluate(async el=>{await el.decode();return el.naturalWidth>0}));}
}await c.close();
}assert.deepEqual(errors,[]);console.log('Both issues and all six offline editions: shared deals, unchanged 12 EP.01 cards, seven EP.02 cards, galleries, transport story, two-way locale navigation, downloads and responsive widths verified.');
}finally{await b.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
