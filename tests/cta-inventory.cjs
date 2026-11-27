const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const files=[['EP.01','/index.html','zh-Hant'],['EP.01','/index.html','zh-Hans'],['EP.01','/index.html','en'],['EP.02','/bkk-ep02-zh.html','zh-Hant'],['EP.02','/ep02-zh-Hans.html','zh-Hans'],['EP.02','/ep02-en.html','en']];
const canonical=require('../docs/analytics-catalog.json');

(async()=>{
 const browser=await chromium.launch({channel:'msedge'});
 const inventory={};
 try{
  for(const [episode,pathname,language] of files){
   const page=await browser.newPage();
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    const file=path.join(root,url.pathname);
    if(url.hostname!=='huxiago.com'||!file.startsWith(root+path.sep)||!fs.existsSync(file)||!/\.(html|css|js)$/.test(file))
      return route.fulfill({status:200,body:''});
    if(/\.html$/.test(file)){
      const hook="document.addEventListener('click',auditClick,true);";
      const raw=fs.readFileSync(file,'utf8');
      assert.ok(raw.includes(hook));
      const helper=`window.inspectHuxControls=()=>[...document.querySelectorAll(controlSelector+',video')].filter(element=>!element.closest('[inert]')&&!element.matches(':disabled,[aria-disabled="true"],.ticket-disabled')&&!(element.matches('label[for]')&&element.control)).flatMap(element=>element.matches('video')?['play','pause','seek'].map(action=>describeControl(element,action)):[describeControl(element)]);`;
      return route.fulfill({contentType:'text/html',body:raw.replace(hook,helper+'\n'+hook)});
    }
    return route.fulfill({path:file});
   });
   await page.goto('https://huxiago.com'+pathname,{waitUntil:'load'});
   if(episode==='EP.01'&&language!=='zh-Hant'){
     await page.locator('[data-hux-lang="'+language+'"]').evaluate(button=>button.click());
     await page.waitForFunction(wanted=>document.documentElement.lang===wanted,language);
   }
   const payloads=await page.evaluate(()=>window.inspectHuxControls());
   const sites=canonical[episode];
   for(const place of sites){
     assert.ok(payloads.some(row=>row.cta_id===place.id+':toc'&&row.content_category===place.tag),episode+' '+place.name);
     assert.ok(payloads.some(row=>row.cta_id===place.id+':open'),episode+' '+place.name);
   }
   const first=sites[0];
   await page.locator('.toc a[href="#'+first.anchor+'"]').evaluate(link=>link.click());
   const audit=await page.evaluate(()=>[...dataLayer].filter(row=>row[1]==='ui_click').at(-1)[2]);
   assert.equal(audit.link_id,first.id+':toc');
   assert.equal(audit.place_name,first.name);
   assert.equal(audit.content_category,first.tag);
   assert.equal(audit.episode,episode);
   assert.equal(audit.content_language,language);
   assert.equal(await page.evaluate(()=>clarity.q.some(command=>command[0]==='event'&&command[1]==='ui_click')),true);
   const journal=inventory[episode]??={};
   for(const row of payloads){
     const id=row.link_id;
     assert.ok(id&&row.link_text);
     assert.equal(row.link_url?.includes('?')||false,false);
     const previous=journal[id];
     if(previous){
       previous.labels[language]=row.link_text;
       continue;
     }
     journal[id]={id,labels:{[language]:row.link_text},action:row.action_type,place:row.place_id,offer:row.offer_id,tag:row.content_category};
   }
   console.log(episode+' '+language+' '+payloads.length+' control definitions');
   await page.close();
  }
 }finally{await browser.close();}
 const output=Object.fromEntries(Object.entries(inventory).map(([ep,values])=>[ep,Object.values(values).sort((a,b)=>a.id.localeCompare(b.id,'en'))]));
 const contents=JSON.stringify(output,null,2)+'\n';
 const destination=path.join(root,'docs/analytics-controls.json');
 if(process.argv.includes('--write'))fs.writeFileSync(destination,contents);
 else assert.equal(fs.readFileSync(destination,'utf8').replaceAll('\r\n','\n'),contents);
 console.log(Object.fromEntries(Object.entries(output).map(([ep,rows])=>[ep,rows.length])));
})().catch(error=>{console.error(error);process.exitCode=1;});
