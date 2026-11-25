const { chromium }=require(process.env.HUX_PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), http=require('node:http');
const root=path.resolve(__dirname, "..");
const {pathToFileURL}=require('node:url');
const links=['https://esimconnect.com.tw/#/access/esimbuy?region=泰國&referencecode=HUXIAGO','https://www.tablecheck.com/en/kushiro-omakase-and-japanese-dining-bangkok/reserve/message?utm_source=huxiago'];
const silqLink='https://book-directonline.com/properties/SILQHotelResidencedirect?locale=en&promocode=HUXIATHAI';
const offers = require('../docs/shared-deals.json');
const server=http.createServer((req,res)=>{const p=path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname));if(!p.startsWith(root+path.sep)){res.writeHead(403);return res.end()}fs.readFile(p,(e,v)=>{if(e){res.writeHead(404);return res.end()}res.setHeader('Content-Type',p.endsWith('.html')?'text/html; charset=utf-8':p.endsWith('.mp4')?'video/mp4':'application/octet-stream');res.end(v)})});
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
  const photos = cards.locator('.ticket-photo-image');
  const logos = cards.locator('.ticket-photo-logo');
  assert.equal(await photos.count(), 2);
  assert.equal(await logos.count(), 2);
  await cards.locator('.ticket-photo img').evaluateAll(images=>Promise.all(images.map(async image=>{
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
      const label=getComputedStyle(action.querySelector('.ticket-cta-label'));
      return {
        amount: [value.fontFamily,value.fontSize,value.fontWeight],
        textColor: label.color,
        labelBackground: label.backgroundColor,
        labelRadius: label.borderRadius,
        discountColor: value.color,
        discountShadow: value.textShadow,
        stroke: value.webkitTextStrokeWidth,
        labelBorder: label.borderTopWidth,
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
  assert.deepEqual(styles.map(style => style.discountColor), ['rgb(255, 249, 238)', 'rgb(255, 249, 238)', 'rgb(236, 88, 0)']);
  assert.notEqual(styles[0].discountShadow, 'none');
  assert.equal(styles[1].discountShadow, styles[0].discountShadow);
  for (const style of styles) {
    assert.deepEqual(style.amount, styles[0].amount, 'Share the original eSIM discount style');
    assert.equal(style.textColor, 'rgb(82, 48, 29)');
    assert.equal(style.labelBackground, 'rgb(255, 242, 202)');
    assert.equal(style.labelRadius, '999px');
    assert.equal(style.stroke, '0px');
    assert.equal(style.labelBorder, '1px');
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
  kushiro: [5, 17, 1], silq: [7, 22, 1], 'gan-da': [6, 19, 0], 'hani-spa': [6, 16, 0],
  chowchercof: [6, 14, 0], 'bang-sue-junction': [7, 19, 0], 'saen-saep': [7, 21, 0],
};
async function verifyArticles(page) {
  for (const [id, [headings, paragraphs, tables]] of Object.entries(articleCounts)) {
    const card = page.locator('#' + id);
    const article = card.locator('.story-copy');
    assert.equal(await article.locator('.story-heading').count(), headings, id + ' headings');
    assert.equal(await article.locator(':scope > p').count(), paragraphs, id + ' paragraphs');
    assert.equal(await article.locator('table').count(), tables, id + ' tables');
    assert.equal(await card.locator('video, iframe').count(), 0, id + ' video deferred');
  }
  assert.equal(await page.locator('#kushiro .story-table tbody tr').count(), 4);
  assert.equal(await page.locator('#silq .story-table tbody tr').count(), 2);
  assert.equal(await page.locator('#kushiro .story-copy a[href*="tablecheck.com"]').getAttribute('href'), links[1]);
  assert.equal(await page.locator('#silq .story-copy a[href*="book-directonline.com"]').getAttribute('href'),
    'https://book-directonline.com/properties/SILQHotelResidencedirect?locale=en&promocode=HUXIATHAI');
}
const galleryCounts = {
  kushiro: 10, silq: 16, 'gan-da': 14, 'hani-spa': 10,
  chowchercof: 12, 'bang-sue-junction': 10, 'saen-saep': 6,
};
async function verifyEp02Galleries(page) {
  for (const [id, count] of Object.entries(galleryCounts)) {
    const stop = page.locator('#' + id);
    await stop.evaluate(details => { details.open = true; });
    const isMall = id === 'bang-sue-junction';
    const images = stop.locator(isMall ? '.story-photo img' : '.gallery figure img');
    if (isMall) {
      assert.equal(await stop.locator('.gallery').count(), 0);
      const captions = await stop.locator('.story-photo').evaluateAll(photos => photos.map(photo => ({
        caption: photo.querySelector('figcaption').textContent,
        followsParagraph: photo.previousElementSibling?.tagName === 'P',
      })));
      assert(captions.every(item => item.followsParagraph));
      assert.match(captions[1].caption, /1.*2|一、二楼|first and second/);
      assert.match(captions[5].caption, /Mono Loop/);
    }
    assert.equal(await images.count(), count, id + ' gallery photo count');
    const complete = await images.evaluateAll(async items => {
      return Promise.all(items.map(async img => {
        img.loading = 'eager';
        await img.decode();
        const caption = img.closest('figure').querySelector('figcaption')?.textContent.trim();
        return img.naturalWidth > 0 && img.src.startsWith('data:image/webp;') && caption &&
          img.alt === (img.closest('.ep02-reel') ? '' : caption);
      }));
    });
    assert(complete.every(Boolean), id + ' photos, captions and alt text');
    await stop.evaluate(details => { details.open = false; });
  }
}
async function verifyReelsAndPromos(page, locale) {
  assert.equal(await page.locator('.ep02-reel iframe').count(), 0, 'Reels load on request');
  const posters = {
    'hani-spa': ['有兩間分店，我們都來這間', '有两家分店，我们都来这家', 'There are two branches, and this is the one we visit'],
    'saen-saep': ['CentralWorld 附近就有碼頭', 'CentralWorld 附近就有码头', 'There’s a pier near CentralWorld'],
  };
  const index = ['zh-Hant', 'zh-Hans', 'en'].indexOf(locale);
  for (const [id, captions] of Object.entries(posters)) {
    const first = page.locator('#' + id + ' .gallery figure').first();
    assert.equal(await first.locator('figcaption').textContent(), captions[index]);
    assert.equal(await first.locator('img').getAttribute('src'), await page.locator('#' + id + ' summary .thumb').getAttribute('src'));
  }
  for (const [id, url] of [['kushiro', links[1]], ['silq', silqLink]]) {
    const promo = page.locator('#' + id + ' .story-promo');
    assert.equal(await promo.locator('.story-promo-link').getAttribute('href'), url);
    assert.equal(await promo.locator('.story-promo-discount').textContent(), offers[id].badge[index]);
  }
  assert.equal(await page.locator('#silq .story-promo-code').textContent(), 'HUXIATHAI');
  const originals = await page.locator('.ep02-reel :is(.reel-origin, .reel-external)').evaluateAll(links => links.map(a => a.href));
  assert.deepEqual(originals, ['https://www.instagram.com/p/DR1D9Q9iSvM/', 'https://www.instagram.com/p/DdYtIjNJEow/', 'https://www.instagram.com/reel/DfIXxHiTF4C/']);
  const fallback = page.locator('#kushiro .gallery .reel-external');
  assert.equal(await fallback.getAttribute('href'), originals[0]);
  assert.equal(await fallback.getAttribute('target'), '_blank');
  const silqReel = page.locator('#silq .gallery .ep02-reel[data-video]').filter({has: page.locator('.reel-origin')});
  assert.equal(await silqReel.count(), 1);
  assert.equal(await silqReel.evaluate(el => el.parentElement.children[1] === el), true);
  assert.equal(await silqReel.locator('.reel-origin').getAttribute('href'), originals[2]);
  const normalWidth = page.viewportSize();
  for (const width of [320, 390, 695, 1440]) {
    await page.setViewportSize({width, height: normalWidth.height});
    for (const stop of ['#kushiro', '#silq']) {
      const card = page.locator(stop);
      await card.evaluate(el => { el.open = true; });
      const figures = await card.locator('.gallery > figure').evaluateAll(items => items.map(figure => {
        const box = figure.getBoundingClientRect();
        const media = figure.firstElementChild.getBoundingClientRect();
        return [box.height, media.height];
      }));
      assert(figures.length > 1);
      assert(figures.every(([height, media]) => Math.abs(height - figures[0][0]) < 1 && Math.abs(media - figures[0][1]) < 1),
        stop + ' media and card heights match at ' + width + 'px: ' + JSON.stringify(figures));
      assert(await card.locator('.story-promo').evaluate(promo => {
        const reference = document.querySelector('.ticket-feature .ticket-cta');
        const style = getComputedStyle(promo);
        const original = getComputedStyle(reference);
        return style.backgroundColor === original.backgroundColor && style.backgroundImage === original.backgroundImage;
      }));
      if (stop === '#kushiro') {
        assert(await card.locator('.story-copy .ep02-reel').evaluate(reel => {
          const parent = reel.parentElement.getBoundingClientRect();
          const box = reel.getBoundingClientRect();
          const media = reel.querySelector('.reel-viewport').getBoundingClientRect();
          return Math.abs(parent.left + parent.width / 2 - box.left - box.width / 2) < 1 &&
            Math.abs(media.width / media.height - 9 / 16) < .02;
        }), 'Article Reel is centred and portrait');
      }
      await card.evaluate(el => { el.open = false; });
    }
  }
  await page.setViewportSize(normalWidth);
}
async function verifyMapAndLocalVideos(page, offline) {
  const originalSize = page.viewportSize();
  await page.setViewportSize({width: 390, height: 900});
  const transport = page.locator('#saen-saep');
  const toc = page.locator('.toc-item[href="#saen-saep"]');
  await toc.click();
  await page.waitForFunction(() => location.hash === '#saen-saep' && document.getElementById('saen-saep')?.open);
  assert(await transport.locator('.story-copy').isVisible());
  const map = transport.locator('.route-map-open');
  assert(await map.locator('img').evaluate(async img => {img.loading = 'eager'; await img.decode(); return img.naturalWidth > 1000;}));
  const pageUrl = page.url();
  await map.click();
  const dialog = transport.locator('#canal-route');
  assert(await dialog.isVisible());
  const pins = dialog.locator('.canal-pin');
  assert.equal(await pins.count(), 28);
  assert(await dialog.locator('.canal-viewport').evaluate(el => el.scrollWidth > el.clientWidth));
  await pins.nth(0).click();
  await pins.nth(25).click();
  assert.equal(await dialog.locator('.canal-from').inputValue(), '0');
  assert.equal(await dialog.locator('.canal-to').inputValue(), '25');
  assert.match(await dialog.locator('.canal-trip').textContent(), /Pratunam/);
  assert((await dialog.locator('.canal-selected').getAttribute('points')).split(' ').length === 26);
  await dialog.locator('.canal-from').selectOption('26');
  assert.match(await dialog.locator('.canal-trip').textContent(), /向西|Westbound/);
  assert.equal(page.url(), pageUrl);
  await page.keyboard.press('Escape');
  assert.equal(await dialog.isVisible(), false);
  assert.equal(await transport.locator('.gallery figure[data-video]').count(), 0);
  assert.equal(await transport.locator('.story-video-track .canal-clip').count(), 3);
  await transport.evaluate(el => {el.open = false;});

  const cards = page.locator('figure[data-video]');
  assert.equal(await cards.count(), 8);
  for (const card of await cards.all()) {
    const kind = await card.getAttribute('data-kind');
    const correctSource = await card.evaluate((el, isOffline) => isOffline ?
      el.dataset.video.startsWith('data:video/mp4;base64,') : el.dataset.video.startsWith('media/ep02-'), offline);
    assert.equal(kind, 'video');
    assert(correctSource);
    if (await card.evaluate(el => el.matches('.canal-clip'))) {
      assert.equal(await card.locator('.clip-actions button').count(), 3);
    } else {
      assert(await card.locator('.ep01-reel-play').evaluate(button =>
        getComputedStyle(button).backgroundColor === 'rgba(36, 30, 27, 0.18)'));
    }
  }
  for (const card of await cards.all()) {
    const id = await card.evaluate(el => el.closest('details.stop').id);
    const stop = page.locator('#' + id);
    await stop.evaluate(el => {el.open = true;});
    const standalone = id === 'saen-saep';
    const originalUrl = page.url();
    const play = card.locator(standalone ? '.clip-pause' : '.ep01-reel-play');
    await play.click();
    const player = card.locator('video');
    await player.evaluate(video => new Promise((resolve, reject) => {
      if (video.currentTime > 0 && video.readyState >= 2) return resolve();
      const timer = setTimeout(() => reject(Error(video.error?.message || 'Video did not start')), 12000);
      video.addEventListener('timeupdate', () => {clearTimeout(timer); resolve();}, {once: true});
    }));
    assert(await player.evaluate(video => video.duration > 0 && video.videoWidth < video.videoHeight));
    assert.equal(page.url(), originalUrl, 'Play directly from the first click');
    assert.equal(await page.locator('.ep02-reel iframe').count(), 0);
    assert(await player.evaluate(video => Math.abs(video.clientWidth / video.clientHeight - 9 / 16) < .02));
    if (standalone) {
      const sound = card.locator('.clip-sound');
      assert(await player.evaluate(video => video.muted));
      await sound.click();
      await card.locator('.clip-sound[aria-pressed="true"]').waitFor({state: 'visible'});
      assert(await player.evaluate(video => !video.muted));
      await sound.click();
      await play.click();
      assert(await player.evaluate(video => video.paused));
      await play.click();
    }
    const before = await player.evaluate(video => video.currentTime);
    await card.locator('.reel-pip-launch').click();
    assert.equal(await page.locator('.hux-reel-pip video').count(), 1);
    assert.equal(await page.locator('video').count(), 1);
    await page.waitForFunction(time => {
      const video = document.querySelector('.hux-reel-pip video');
      return !video.paused && video.currentTime > time + 0.08;
    }, before, {timeout: 5000});
    await page.keyboard.press('Escape');
    assert.equal(await card.locator('video').count(), 1);
    await card.locator('video').evaluate(video => video.pause());
    await stop.evaluate(el => {el.open = false;});
  }
  await page.setViewportSize(originalSize);
}
async function verifyEp01MobileMedia(page) {
  const originalSize = page.viewportSize();
  await page.setViewportSize({width: 390, height: 844});
  const reels = await page.locator('.reel-figure[data-kind="reel"] .reel-viewport').evaluateAll(players =>
    players.map(player => getComputedStyle(player).aspectRatio));
  assert(reels.every(ratio => ratio === '9 / 16'), 'EP.01 mobile Reel frames are portrait');
  const videos = await page.locator('.clip-media > video').evaluateAll(players => players.map(player => {
    const style = getComputedStyle(player);
    return style.objectFit === 'contain' && style.maxHeight === 'none';
  }));
  assert(videos.every(Boolean), 'EP.01 mobile videos preserve the full native frame');
  await page.setViewportSize(originalSize);
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
await affirm(p,lang);assert.equal(await p.locator('details.card').count(),12);await verifyMaps(p,1);await verifyEp01MobileMedia(p);
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
await verifyReelsAndPromos(p,lang);
await verifyMapAndLocalVideos(p,false);
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
else {offlineRail=await railLayout(q);await verifyEp01MobileMedia(q);}
if(name===file){await verifyArticles(q);await verifyEp02Galleries(q);await verifyReelsAndPromos(q,lang);await verifyMapAndLocalVideos(q,true);}
}await c.close();
}assert.deepEqual(errors,[]);console.log('Both issues and all six offline editions: station maps and coupon links, matching rail and mobile layout, rail navigation and share, three linked photo tickets and same-size pink/blue COMING SOON tickets, unchanged 12 EP.01 cards, seven EP.02 cards, galleries, 28-pier interactive map, TOC auto-open and all eight native videos, two-way locale navigation, downloads and responsive widths verified.');
}finally{await b.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
