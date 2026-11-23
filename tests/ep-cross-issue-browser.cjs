const { chromium }=require(process.env.HUX_PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), http=require('node:http');
const root=path.resolve(__dirname, "..");
const {pathToFileURL}=require('node:url');
const links=['https://esimconnect.com.tw/#/access/esimbuy?region=泰國&referencecode=HUXIAGO','https://www.tablecheck.com/en/kushiro-omakase-and-japanese-dining-bangkok/reserve/message?utm_source=huxiago'];
const silqLink='https://book-directonline.com/properties/SILQHotelResidencedirect?locale=en&promocode=HUXIATHAI';
const offers = require('../docs/shared-deals.json');
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname));if(!p.startsWith(root+path.sep)){res.writeHead(403);return res.end()}fs.readFile(p,(e,v)=>{if(e){res.writeHead(404);return res.end()}res.setHeader('Content-Type',p.endsWith('.html')?'text/html; charset=utf-8':'application/octet-stream');res.end(v)})});
const locations = require('../docs/guide-locations.json');
const mapDestinations = places => places.map(place => place.url);
async function verifyMaps(page, issue) {
  assert.equal(await page.locator('#deals .map-link').count(), 0);
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
  assert.match(await page.locator('#silq .story-copy').textContent(), /2027.*HUXIATHAI|HUXIATHAI.*2027/);
}
async function affirm(page, locale) {
  const cards=page.locator('#deals [data-shared-deal]');
  assert.equal(await cards.count(), 3);
  const actions = cards.locator('.ticket-cta');
  assert.deepEqual(await actions.evaluateAll(elements=>elements.map(a=>a.getAttribute('href'))), [...links, silqLink]);
  assert.deepEqual(await actions.evaluateAll(elements=>elements.map(a=>a.dataset.ctaId)),
    ['huxiago-esim','ep02-kushiro-offer','ep02-silq-offer']);
  const index=['zh-Hant','zh-Hans','en'].indexOf(locale);
  assert.deepEqual(await cards.locator('.ticket-value').allTextContents(),
    ['esim','kushiro','silq'].map(key=>offers[key].badge[index]));
  assert.equal(await cards.locator('.ticket-copy').textContent(), offers.esim.body[index]);
  assert.equal(await cards.locator('.ticket-code').textContent(), 'HUXIATHAI');
  const photos=cards.locator('.ticket-photo img');
  assert.equal(await photos.count(), 2);
  await photos.evaluateAll(images=>Promise.all(images.map(async image=>{
    image.loading='eager';
    await image.decode();
    if (!image.naturalWidth || !image.src.startsWith('data:image/webp;')) throw Error('Offer image is not available offline');
  })));
}
async function verifySharedOfferStyle(page) {
  const styles = await page.locator('#deals [data-shared-deal]').evaluateAll(cards => {
    return cards.map(card => {
      const amount=card.querySelector('.ticket-value');
      const action=card.querySelector('.ticket-cta');
      const value=getComputedStyle(amount);
      const style=getComputedStyle(action);
      return {
        amount: [value.fontFamily,value.fontSize,value.fontWeight],
        textColor: getComputedStyle(action.querySelector('.ticket-cta-label')).color,
        discountColor: value.color,
        stroke: value.webkitTextStrokeWidth,
        labelBorder: getComputedStyle(action.querySelector('.ticket-cta-label')).borderTopWidth,
        background: style.backgroundColor,
        borderRadius: style.borderRadius,
        height: action.offsetHeight,
        fullWidth: Math.abs(action.getBoundingClientRect().width-card.clientWidth)<=1,
        atBottom: Math.abs(action.offsetTop+action.offsetHeight-card.clientHeight)<=1,
        photoAboveValue: !card.querySelector('.ticket-photo img') ||
          card.querySelector('.ticket-photo').getBoundingClientRect().bottom <= amount.getBoundingClientRect().top,
      };
    });
  });
  assert.deepEqual(styles.map(style => style.discountColor), ['rgb(255, 249, 238)', 'rgb(9, 59, 43)', 'rgb(236, 88, 0)']);
  for (const style of styles) {
    assert.deepEqual(style.amount, styles[0].amount, 'Share the original eSIM discount style');
    assert.equal(style.textColor, 'rgb(255, 255, 255)');
    assert.equal(style.stroke, '0px');
    assert.equal(style.labelBorder, '0px');
    assert.equal(style.background, 'rgb(251, 121, 46)');
    assert.equal(style.borderRadius, '0px');
    assert(style.height>=58 && style.fullWidth && style.atBottom && style.photoAboveValue, 'Use a full-width footer below the discount: '+JSON.stringify(style));
  }
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
    top: ticket.offsetTop,
    label: ticket.querySelector('.ticket-value').textContent.trim(),
    hasAction: Boolean(ticket.querySelector('a, button')),
  })));
  assert.deepEqual(cards.map(card => card.key), ['esim', 'kushiro', 'silq', 'transport', 'dining-experiences']);
  assert.deepEqual(cards.slice(3).map(card => card.color), ['rgb(245, 205, 208)', 'rgb(175, 230, 245)']);
  assert(cards.slice(3).every(card => card.label === 'COMING SOON' && !card.hasAction));
  const first = cards[0];
  assert(first.width > 0 && first.height > 0 &&
    cards.every(card => Math.abs(card.width-first.width)<=1 && Math.abs(card.height-first.height)<=1 && card.top===first.top),
    'All five tickets share the same dimensions in one row');
  const track = page.locator('#deals .deal-track');
  assert.equal(await track.evaluate(el => getComputedStyle(el).scrollbarWidth), 'none');
  assert(await track.evaluate(el => el.scrollWidth > el.clientWidth),
    'Additional deals are reachable by horizontal scroll');
}
const articleCounts = {
  kushiro: [5, 18, 1], silq: [7, 24, 1], 'gan-da': [6, 19, 0], 'hani-spa': [6, 16, 0],
  chowchercof: [6, 14, 0], 'bang-sue-junction': [7, 19, 0], 'saen-saep': [7, 21, 0],
};
async function verifyArticles(page) {
  for (const [id, [headings, paragraphs, tables]] of Object.entries(articleCounts)) {
    const card = page.locator('#' + id);
    const article = card.locator('.story-copy');
    assert.equal(await article.locator('.story-heading').count(), headings, id + ' headings');
    assert.equal(await article.locator('p').count(), paragraphs, id + ' paragraphs');
    assert.equal(await article.locator('table').count(), tables, id + ' tables');
    assert.equal(await card.locator('video, iframe, a[href*="instagram.com"]').count(), 0, id + ' video deferred');
  }
  assert.equal(await page.locator('#kushiro .story-table tbody tr').count(), 4);
  assert.equal(await page.locator('#silq .story-table tbody tr').count(), 2);
  assert.equal(await page.locator('#kushiro .story-copy a[href*="tablecheck.com"]').getAttribute('href'), links[1]);
  assert.equal(await page.locator('#silq .story-copy a[href*="book-directonline.com"]').getAttribute('href'),
    'https://book-directonline.com/properties/SILQHotelResidencedirect?locale=en&promocode=HUXIATHAI');
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
assert.deepEqual(tickets.map(x=>x.key), ['esim','kushiro','silq']);
assert.deepEqual(tickets.map(x=>x.hasAction), [true,true,true]);
assert(tickets.every(x=>x.icon));
assert.equal(new Set(tickets.map(x=>x.icon)).size, 3);
const reference = new Map();
for(const width of widths){await p.setViewportSize({width,height:900});reference.set(width,await railLayout(p));await verifyPlaceholders(p);await verifySharedOfferStyle(p);}
await p.locator('.episode-trigger').click();await p.locator('.ep02-link').click();
await p.waitForURL(u=>u.pathname==='/ep02-'+lang+'.html');await affirm(p,lang);
assert.equal(await p.locator('details.card').count(),7);await verifyMaps(p,2);
await verifyArticles(p);
await verifyEp02Galleries(p);
await p.locator('#kushiro summary').click();
assert(await p.locator('#kushiro .gallery').evaluate(el=>el.scrollWidth>el.clientWidth));
for(const width of widths){
  await p.setViewportSize({width,height:900});
  assert.deepEqual(await railLayout(p), reference.get(width));
  await verifyPlaceholders(p);await verifySharedOfferStyle(p);
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
await verifyPlaceholders(q);await verifySharedOfferStyle(q);
if(name===file)assert.deepEqual(await railLayout(q),offlineRail);
else offlineRail=await railLayout(q);
if(name===file){await verifyArticles(q);await verifyEp02Galleries(q);}
}await c.close();
}assert.deepEqual(errors,[]);console.log('Both issues and all six offline editions: station maps and coupon links, matching rail and mobile layout, rail navigation and share, three linked photo tickets and same-size pink/blue COMING SOON tickets, unchanged 12 EP.01 cards, seven EP.02 cards, galleries, transport story, two-way locale navigation, downloads and responsive widths verified.');
}finally{await b.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
