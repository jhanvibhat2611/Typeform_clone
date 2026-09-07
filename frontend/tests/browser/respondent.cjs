// Optional browser integration check; use a disposable backend database, never user data.
// PLAYWRIGHT_MODULE points to an existing Playwright installation; no app dependency added.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const api = process.env.TEST_API || 'http://127.0.0.1:8001';
const ui = process.env.TEST_UI || 'http://127.0.0.1:3001';
const artifacts = process.env.TEST_ARTIFACTS || '.artifacts';
async function request(path, body) {
  const response = await fetch(api + path, body ? {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)} : {});
  assert.ok(response.ok, await response.clone().text()); return response.json();
}
(async () => {
  fs.mkdirSync(artifacts,{recursive:true});
  const form = await request('/api/forms',{title:'Stage 5 navigation verification'});
  const types = ['short_text','long_text','multiple_choice','dropdown','email','number','yes_no','rating'];
  const questions = types.map((type,i)=>({id:randomUUID(),type,prompt:i===0?'Which year of study are you in?':`Question ${i+1}: ${type}`,description:'',required:true,options:['multiple_choice','dropdown'].includes(type)?[{id:randomUUID(),label:'First'},{id:randomUUID(),label:'Second'}]:[]}));
  const pub = (await request(`/api/forms/${form.id}/publish`,{title:form.title,questions})).publication;
  const browser = await chromium.launch({channel:process.env.TEST_BROWSER || 'msedge',headless:true});
  try {
    const page = await browser.newPage({viewport:{width:1920,height:898},deviceScaleFactor:1});
    let failOnce = true; const bodies=[];
    await page.route('**/api/**', async route=>{
      const url=new URL(route.request().url());
      if(url.pathname.endsWith('/submissions')) {
        bodies.push(route.request().postDataJSON());
        if(failOnce){failOnce=false;await route.abort('failed');return;}
      }
      const response=await route.fetch({url:api+url.pathname});await route.fulfill({response});
    });
    await page.goto(ui+'/f/'+pub.public_id);
    const heading=page.locator('[data-panel=active] .respondent-question h1');
    const next=()=>page.getByRole('button',{name:'Next question',exact:true});
    const back=()=>page.getByRole('button',{name:'Previous question',exact:true});
    const settle=()=>page.waitForFunction(()=>document.querySelector('[data-panel=active] .respondent-question')?.getAttribute('aria-busy')==='false');
    await page.getByRole('button',{name:'Start',exact:true}).waitFor();
    await page.screenshot({path:artifacts+'/stage5-welcome.png'});
    await page.getByRole('button',{name:'Start',exact:true}).press('Enter');
    await settle(); await heading.waitFor();
    await page.waitForFunction(()=>document.querySelector('[data-panel=active]').getAnimations().length===0);
    const box=await heading.boundingBox(); console.log('Reference heading position:',box); assert.ok(box.y>290 && box.y<340);
    const sizing = await page.locator('[data-panel=active] .respondent-question').evaluate(element => {
      const input = element.querySelector('input');
      const button = element.querySelector('.advance').getBoundingClientRect();
      return { width: input.getBoundingClientRect().width, heading: getComputedStyle(element.querySelector('h1')).fontSize,
        input: getComputedStyle(input).fontSize, buttonWidth: button.width, buttonHeight: button.height,
        focusedShadow: getComputedStyle(input).boxShadow, zoom: visualViewport.scale };
    });
    assert.deepEqual(sizing, {width:1080,heading:'40px',input:'40px',buttonWidth:88,buttonHeight:60,
      focusedShadow:'rgb(107, 88, 111) 0px 1px 0px 0px',zoom:1});
    console.log('Desktop sizing:', sizing);
    await page.screenshot({path:artifacts+'/stage5-desktop.png'});
    await next().focus();await next().press('ArrowDown');assert.equal(await heading.textContent(),questions[0].prompt+' *');await page.locator('.respondent-error').waitFor();
    assert.equal(await page.locator('#public-answer').evaluate(e=>e===document.activeElement),true);
    await page.locator('#public-answer').fill('Second year');
    await page.locator('#public-answer').press('ArrowDown');assert.ok((await heading.textContent()).includes(questions[0].prompt));
    // Dispatch in one task to exercise the synchronous guard, bypassing Playwright's auto-wait.
    await next().evaluate(b=>{b.click();b.click();b.click();});await page.waitForTimeout(60);assert.ok(await page.locator('[data-panel=outgoing]').evaluate(e=>e.inert && e.getAttribute('aria-hidden')==='true' && new DOMMatrix(getComputedStyle(e).transform).m42<0));await settle();assert.ok((await heading.textContent()).includes('long_text'));
    await page.locator('textarea').fill('First line');await page.locator('textarea').press('Enter');await page.locator('textarea').press('a');assert.equal(await page.locator('textarea').inputValue(),'First line\na');
    await back().click();await page.waitForTimeout(60);assert.ok(await page.locator('[data-panel=outgoing]').evaluate(e=>new DOMMatrix(getComputedStyle(e).transform).m42>0));await settle();assert.equal(await page.locator('#public-answer').inputValue(),'Second year');
    await page.locator('#public-answer').press('Enter');await settle();assert.equal(await page.locator('textarea').inputValue(),'First line\na');
    await page.locator('textarea').press('Control+Enter');await settle();
    await page.getByRole('radio',{name:'First',exact:true}).check();await page.getByRole('radio',{name:'First',exact:true}).press('ArrowDown');assert.ok((await heading.textContent()).includes('multiple_choice'));assert.equal(await page.getByRole('radio',{name:'Second',exact:true}).isChecked(),true);
    await next().click();await settle();const combo = page.getByRole('combobox');
    await next().click(); await page.locator('.respondent-error').waitFor();
    assert.equal(await combo.evaluate(e=>e===document.activeElement),true);
    await combo.press('ArrowDown'); await combo.press('End'); await combo.press('Escape');
    assert.equal(await combo.getAttribute('aria-expanded'),'false');
    await combo.press('ArrowDown'); await combo.press('Home'); await combo.press('Enter');
    assert.equal(await combo.innerText(),'First');
    await back().click();await settle();await next().click();await settle();
    assert.equal(await page.getByRole('combobox').innerText(),'First');assert.ok((await heading.textContent()).includes('dropdown'));await next().click();await settle();
    await page.locator('#public-answer').fill('invalid');await page.locator('#public-answer').press('Enter');assert.ok((await heading.textContent()).includes('email'));await page.locator('.respondent-error').waitFor();
    await page.locator('#public-answer').fill('review@example.com');await page.locator('#public-answer').press('Enter');await settle();
    await page.locator('#public-answer').fill('0');await page.locator('#public-answer').press('Enter');await settle();
    await page.getByRole('radio',{name:'No',exact:true}).check();await next().click();await settle();await page.getByRole('radio',{name:'4',exact:true}).check();
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:artifacts+'/stage5-mobile.png'});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    const nav=await page.locator('.respondent-navigation').boundingBox();assert.ok(nav.x>=0&&nav.y+nav.height<=844);
    assert.equal(await next().isDisabled(),true);
    await next().evaluate(b=>b.click());assert.equal(bodies.length,0);
    await page.getByRole('button',{name:'Submit',exact:true}).evaluate(b=>{b.click();b.click();});await page.getByRole('button',{name:'Retry submission',exact:true}).waitFor();
    await page.getByRole('button',{name:'Retry submission',exact:true}).click();await page.getByRole('heading',{name:/Thanks for completing/}).waitFor();
    assert.equal(bodies.length,2);assert.deepEqual(bodies[0],bodies[1]);
    const result=await request(`/api/forms/${form.id}/results`);assert.equal(result.response_count,1);
    const detail=await request(`/api/forms/${form.id}/submissions/${bodies[0].submission_id}`);assert.equal(detail.answers[questions[5].id],0);assert.equal(detail.answers[questions[6].id],false);
    await page.emulateMedia({reducedMotion:'reduce'});await page.goto(ui+'/f/'+pub.public_id);await page.getByRole('button',{name:'Start',exact:true}).click();await settle();await heading.waitFor();await page.locator('#public-answer').fill('Reduced motion');await next().evaluate(b=>{b.click();b.click();});await settle();assert.ok((await heading.textContent()).includes('long_text'));assert.equal(await page.locator('[data-panel=active]').evaluate(e=>e.getAnimations().length),0);
    await page.setViewportSize({width:1280,height:900});
    await page.goto(ui+'/?form='+form.id);await page.locator('.preview-paper').waitFor();
    for(let i=0;i<types.length;i++) {
      const paper=page.locator('.preview-paper');
      if(['multiple_choice','yes_no','rating'].includes(types[i])) await paper.getByRole('radio').first().check();
      else if(types[i]==='dropdown') { await paper.getByRole('combobox').click(); await paper.getByRole('option',{name:'First',exact:true}).click(); }
      else await paper.locator('input,textarea').fill(types[i]==='number'?'0':'Preview only');
      assert.equal(await paper.locator('input,textarea,select,[role=combobox]').first().evaluate(e=>Boolean(e.closest('.respondent-shell'))),false);
      if(i===0) await page.screenshot({path:artifacts+'/stage5-builder-preview.png'});
      if(i<types.length-1) await page.locator('.preview-navigation').getByRole('button',{name:'Next question'}).click();
    }
    assert.equal((await request(`/api/forms/${form.id}/results`)).response_count,1);
    console.log('PASS: all eight controls, validation, error focus, arrows, multiline/Enter, rapid navigation, preserved answers, real submission + failed-network retry, one stored response, mobile, reduced motion.');
    console.log('Fixture form:',form.id);
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
