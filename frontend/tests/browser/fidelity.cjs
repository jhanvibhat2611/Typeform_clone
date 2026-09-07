// Run against disposable local services only. See docs/ui-fidelity-verification.md.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const fs=require('node:fs');
const api=process.env.TEST_API || 'http://127.0.0.1:8001';
const ui=process.env.TEST_UI || 'http://127.0.0.1:3001';
const output=process.env.TEST_ARTIFACTS || '.artifacts';
assert.ok(['127.0.0.1','localhost'].includes(new URL(api).hostname),'Use a disposable local API');
async function post(path,body){const r=await fetch(api+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});assert.ok(r.ok);return r.json()}
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const form=await post('/api/forms',{title:'Fidelity keyboard and long content'});
 const questions=[
  {id:randomUUID(),type:'dropdown',prompt:'Choose a workshop',description:'',required:false,options:Array.from({length:30},(_,i)=>({id:randomUUID(),label:'Workshop '+String(i+1).padStart(2,'0')}))},
  {id:randomUUID(),type:'long_text',prompt:'Anything else?',description:'',required:true,options:[]},
  {id:randomUUID(),type:'short_text',prompt:'A long question. '.repeat(35),description:'Additional guidance. '.repeat(50),required:true,options:[]},
 ];
 const publication=(await post('/api/forms/'+form.id+'/publish',{title:form.title,questions})).publication;
 const b=await chromium.launch({channel:process.env.TEST_BROWSER || 'msedge',headless:true});
 try{
  const p=await b.newPage({viewport:{width:1918,height:898},deviceScaleFactor:1});
  await p.goto(ui+'/f/'+publication.public_id);await p.getByRole('button',{name:'Start',exact:true}).waitFor();
  assert.deepEqual(await p.evaluate(()=>[devicePixelRatio,visualViewport.scale]),[1,1]);
  await p.screenshot({path:output+'/fidelity-welcome.png'});
  await p.getByRole('button',{name:'Start',exact:true}).click();
  const settle=()=>p.waitForFunction(()=>document.querySelector('[data-panel=active] .respondent-question')?.getAttribute('aria-busy')==='false');
  await settle();
  const panel=p.locator('[data-panel=active]');
  assert.ok(await panel.evaluate(e=>e.scrollHeight<=e.clientHeight+1),'short desktop question should not scroll');
  const combo=p.getByRole('combobox');await combo.press('ArrowDown');await combo.press('End');
  assert.equal(await p.locator('[data-active=true]').innerText(),'Workshop 30');
  await p.screenshot({path:output+'/fidelity-dropdown.png'});
  await combo.press('Enter');assert.equal(await combo.innerText(),'Workshop 30');
  await p.getByRole('button',{name:'Clear answer',exact:true}).click();assert.equal(await combo.innerText(),'Select an option');
  await combo.press('w');await combo.press('Enter');assert.equal(await combo.innerText(),'Workshop 01');
  await combo.click();await combo.press('Tab');assert.equal(await combo.getAttribute('aria-expanded'),'false');
  await p.setViewportSize({width:390,height:844});await combo.click();await p.screenshot({path:output+'/fidelity-mobile-dropdown.png'});await combo.press('Escape');
  assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await p.getByRole('button',{name:'Next question',exact:true}).click();await settle();
  const text=p.locator('textarea');assert.ok((await text.boundingBox()).height<100);
  await text.fill('A long line that wraps across a mobile screen. '.repeat(70));
  assert.ok((await text.boundingBox()).height<=240);
  assert.equal(await text.evaluate(e=>getComputedStyle(e).resize),'none');
  assert.ok(await text.evaluate(e=>e.scrollHeight>e.clientHeight));
  await p.screenshot({path:output+'/fidelity-mobile-long-text.png'});
  await p.getByRole('button',{name:'Next question',exact:true}).click();await settle();
  assert.ok(await panel.evaluate(e=>e.scrollHeight>e.clientHeight),'long content remains scrollable');
  await p.locator('#public-answer').fill('Accessible at the end');
  await p.getByRole('button',{name:'Submit',exact:true}).scrollIntoViewIfNeeded();
  await p.screenshot({path:output+'/fidelity-mobile-long-question.png'});
  // This success belongs only to the disposable test form.
  await p.getByRole('button',{name:'Submit',exact:true}).click();await p.getByRole('link',{name:'Create a form',exact:true}).waitFor();
  assert.equal(await p.getByRole('link',{name:'Create a form',exact:true}).getAttribute('href'),'/');
  await p.setViewportSize({width:1918,height:898});await p.screenshot({path:output+'/fidelity-success.png'});
  await p.emulateMedia({reducedMotion:'reduce'});await p.goto(ui+'/f/'+publication.public_id);await p.getByRole('button',{name:'Start',exact:true}).waitFor();
  assert.equal(await p.locator('.respondent-welcome').evaluate(e=>getComputedStyle(e).animationName),'none');
  console.log('PASS: zoom 100%, short-question scrolling, listbox End/typeahead/Tab/clear, mobile dropdown, growing/scrollable long text, long question access, acknowledged success link, reduced-motion welcome.');
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
