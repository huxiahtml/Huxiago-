const { chromium }=require(process.env.HUX_PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), http=require('node:http');
const root=path.resolve(__dirname, "..");
const {pathToFileURL}=require('node:url');
const links=['https://esimconnect.com.tw/#/access/esimbuy?region=泰國&referencecode=HUXIAGO','https://www.tablecheck.com/en/kushiro-omakase-and-japanese-dining-bangkok/reserve/message?utm_source=huxiago'];
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname));if(!p.startsWith(root+path.sep)){res.writeHead(403);return res.end()}fs.readFile(p,(e,v)=>{if(e){res.writeHead(404);return res.end()}res.setHeader('Content-Type',p.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');res.end(v)})});
const locations = require('../docs/guide-locations.json');
const mapDestinations = places => places.map(place => place.url);
async function verifyMaps(page, issue) {
  const ticket = page.locator('#deals [data-shared-deal="kushiro"]');
  assert.equal(await ticket.locator('.ticket-cta + .ticket-map').getAttribute('href'), locations.kushiro[0].url);
  assert.equal(await ticket.locator('.ticket-address').textContent(), locations.kushiro[0].address);
  if (issue === 1) {
    const covered = await page.locator('details.card').evaluateAll(cards => cards.every(card =>
      [...card.querySelectorAll('a.btn')].some(a => /(?:google\.com\/maps|goo\.gl\/maps|maps\.app\.goo\.gl)/.test(a.href))));
    assert(covered);
    assert.equal(await page.locator('#spot-6 .map-link').getAttribute('href'), locations['muvmi-ari'][0].url);
    return;
  }
  const stopIds = await page.locator('details.card').evaluateAll(cards=>cards.map(card=>card.id));
  for (const id of stopIds) {
    const card = page.locator('#'+id);
    assert.deepEqual(await card.locator('.map-link').evaluateAll(a=>a.map(el=>el.getAttribute('href'))), mapDestinations(locations[id]));
    assert.deepEqual(await card.locator('.location-address').allTextContents(), locations[id].map(place=>place.address));
  }
  assert.equal(await page.locator('#kushiro .place-actions a[href*="tablecheck.com"]').getAttribute('href'), links[1]);
  const silq = page.locator('#silq .place-actions a[href*="book-directonline.com"]');
  assert.equal(await silq.getAttribute('href'),
    'https://book-directonline.com/properties/SILQHotelResidencedirect?locale=en&promocode=HUXIATHAI');
  const locale = await page.locator('html').getAttribute('lang');
  const bookingLabel = {
    'zh-Hant': '帶入九折碼查房價',
    'zh-Hans': '带入九折码查房价',
    en: 'Check rates with 10% off',
  };
  assert((await silq.textContent()).includes(bookingLabel[locale]));
  assert.equal(await silq.getAttribute('target'), '_blank');
  assert.equal(await page.locator('#kushiro .place-actions a[href="https://www.instagram.com/p/DdYtIjNJEow/"]').count(), 1);
  assert.equal(await page.locator('#silq .place-actions a[href="https://www.instagram.com/reel/DfIXxHiTF4C/"]').count(), 1);
  assert.match(await page.locator('#silq .story-copy').textContent(), /2027.*HUXIATHAI|HUXIATHAI.*2027/);
}
const affirm=async(page,locale)=>{const cards=page.locator('#deals [data-shared-deal]'); assert.equal(await cards.count(),2);assert.deepEqual(await cards.locator('.ticket-cta[data-cta-id]').evaluateAll(a=>a.map(x=>x.getAttribute('href'))),links);assert((await cards.nth(1).innerText()).includes(locale==='en'?'20% off':'8 折'))};
async function verifySharedOfferStyle(page, lang) {
  const expected = {'zh-Hant':'餐廳優惠', 'zh-Hans':'餐厅优惠', en:'Dining deal'};
  const kushiro = page.locator('#deals [data-shared-deal="kushiro"]');
  assert.equal(await kushiro.locator('.ticket-eyebrow').textContent(), expected[lang]);
  const styles = await page.locator('#deals [data-shared-deal]').evaluateAll(cards => {
    const rules = ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'color', 'backgroundColor', 'textShadow'];
    return cards.map(card => ['h3', '.ticket-value', '.ticket-eyebrow', '.ticket-cta'].map(sel => {
      const style = getComputedStyle(card.querySelector(sel));
      return rules.map(rule => style[rule]);
    }));
  });
  assert.deepEqual(styles[0], styles[1], 'Kushiro uses the eSIM active ticket typography and palette');
}
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
const ticketStyles = page => page.locator('#deals [data-shared-deal]').evaluateAll(cards => cards.map(card => ({
  key: card.dataset.sharedDeal || card.dataset.upcomingDeal,
  color: getComputedStyle(card).backgroundColor,
  icon: card.querySelector('.ticket-icon svg')?.innerHTML,
  hasAction: Boolean(card.querySelector('.ticket-cta')),
})));
async function verifyPlaceholders(page) {
  const cards = await page.locator('#deals .deal-track article').evaluateAll(tickets => tickets.map(ticket => ({
    key: ticket.dataset.sharedDeal || ticket.dataset.upcomingDeal,
    color: getComputedStyle(ticket).backgroundColor,
    width: ticket.offsetWidth,
    height: ticket.offsetHeight,
    label: ticket.querySelector('.ticket-value').textContent.trim(),
    hasAction: Boolean(ticket.querySelector('a, button')),
  })));
  assert.deepEqual(cards.map(card => card.key), ['esim', 'kushiro', 'transport', 'dining-experiences']);
  assert.deepEqual(cards.slice(2).map(card => card.color), ['rgb(245, 205, 208)', 'rgb(175, 230, 245)']);
  assert(cards.slice(2).every(card => card.label === 'COMING SOON' && !card.hasAction));
  const first = cards[0];
  assert(first.width > 0 && first.height > 0 &&
    cards.every(card => Math.abs(card.width-first.width)<=1 && Math.abs(card.height-first.height)<=1),
    'All four tickets share the same dimensions');
}
const galleryCounts = {
  kushiro: 6, silq: 5, 'gan-da': 5, 'hani-spa': 4,
  chowchercof: 5, 'bang-sue-junction': 5, 'saen-saep': 5,
};
async function verifyEp02Galleries(page) {
  for (const [id, count] of Object.entries(galleryCounts)) {
    const stop = page.locator('#' + id);
    await stop.evaluate(details => { details.open = true; });
    const images = stop.locator('.gallery figure img');
    assert.equal(await images.count(), count, id + ' gallery photo count');
    const complete = await images.evaluateAll(async items => {
      return Promise.all(items.map(async img => {
        img.loading = 'eager';
        await img.decode();
        const caption = img.closest('figure').querySelector('figcaption')?.textContent.trim();
        return img.naturalWidth > 0 && img.src.startsWith('data:image/webp;') && caption && img.alt === caption;
      }));
    });
    assert(complete.every(Boolean), id + ' photos, captions and alt text');
    await stop.evaluate(details => { details.open = false; });
  }
}
const widths = [390, 647, 768, 979, 980, 1200, 1440];

(async()=>{await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
const b=await chromium.launch({executablePath:process.env.HUX_CHROME_BIN,headless:true});
try{const p=await b.newPage({reducedMotion:'reduce'});const errors=[];
await p.addInitScript(() => { Object.defineProperty(navigator,'share',{value: payload => { window.testShare = payload; }}); });p.on('pageerror',e=>errors.push(String(e)));await p.route(/^https?:/,r=>r.request().url().startsWith(origin)?r.continue():r.abort());
for(const lang of ['zh-Hant','zh-Hans','en']){
await p.goto(origin+'/index.html?lang='+lang);
await p.waitForFunction(l=>document.documentElement.lang===l,lang);
await p.waitForFunction(l=>document.querySelector('#deals [data-shared-deal="kushiro"]').textContent.includes(l==='en'?'Book on TableCheck':l==='zh-Hans'?'TableCheck 订位':'TableCheck 訂位'),lang);
await affirm(p,lang);assert.equal(await p.locator('details.card').count(),12);await verifyMaps(p,1);
const tickets = await ticketStyles(p);
assert.deepEqual(tickets.map(x=>x.key), ['esim','kushiro']);
assert.deepEqual(tickets.map(x=>x.hasAction), [true,true]);
assert(tickets.every(x=>x.icon && x.color==='rgb(251, 121, 46)'));
assert.equal(new Set(tickets.map(x=>x.icon)).size, 2);
const reference = new Map();
for(const width of widths){await p.setViewportSize({width,height:900});reference.set(width,await railLayout(p));await verifyPlaceholders(p);await verifySharedOfferStyle(p,lang);}
await p.locator('.episode-trigger').click();await p.locator('.ep02-link').click();
await p.waitForURL(u=>u.pathname==='/ep02-'+lang+'.html');await affirm(p,lang);
assert.equal(await p.locator('details.card').count(),7);await verifyMaps(p,2);
assert.equal(await p.locator('#saen-saep .story-heading').count(),5);
await verifyEp02Galleries(p);
await p.locator('#kushiro summary').click();
assert(await p.locator('#kushiro .gallery').evaluate(el=>el.scrollWidth>el.clientWidth));
for(const width of widths){
  await p.setViewportSize({width,height:900});
  assert.deepEqual(await railLayout(p), reference.get(width));
  await verifyPlaceholders(p);await verifySharedOfferStyle(p,lang);
  const [booking, map] = await p.locator('[data-shared-deal="kushiro"] .ticket-actions a').evaluateAll(links =>
    links.map(el=>{const box=el.getBoundingClientRect();return {top:box.top,left:box.left,right:box.right};}));
  assert(booking.right <= map.left && booking.top === map.top, 'map sits beside booking at width '+width);
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
await q.goto(pathToFileURL(path.join(root,name)).href);await affirm(q,lang);await verifyMaps(q,name===file?2:1);
assert.deepEqual(await ticketStyles(q),tickets);
await verifyPlaceholders(q);await verifySharedOfferStyle(q,lang);
if(name===file)assert.deepEqual(await railLayout(q),offlineRail);
else offlineRail=await railLayout(q);
if(name===file)await verifyEp02Galleries(q);
}await c.close();
}assert.deepEqual(errors,[]);console.log('Both issues and all six offline editions: station and coupon map links, matching rail and mobile layout, rail navigation and share, shared orange tickets and same-size pink/blue COMING SOON tickets, unchanged 12 EP.01 cards, seven EP.02 cards, galleries, transport story, two-way locale navigation, downloads and responsive widths verified.');
}finally{await b.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
