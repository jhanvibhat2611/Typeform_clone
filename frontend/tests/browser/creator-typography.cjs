// Read-only creator typography/layout check against an existing populated form.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ui = process.env.TEST_UI || 'http://127.0.0.1:3001';
const form = process.env.TEST_FORM_ID;
assert.ok(form, 'Set TEST_FORM_ID to an existing form with results');
const output = process.env.TEST_ARTIFACTS || '.artifacts';
(async () => {
  fs.mkdirSync(output, {recursive:true});
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    for (const [width,height,dpr] of [[1280,600,1.5],[1920,900,1],[390,844,1]]) {
      const page = await browser.newPage({viewport:{width,height},deviceScaleFactor:dpr});
      await page.route('**/*', route => ['GET','HEAD'].includes(route.request().method()) ? route.continue() : route.abort());
      for (const [name,path,ready,selectors] of [
        ['dashboard','/','.form-card',['.creator-tabs > span','.workspace-heading h1','.form-card-main h2']],
        ['builder','/?form='+form,'.preview-paper',['.builder-navigation > span','.pages-panel h2']],
        ['results','/forms/'+form+'/results','.table-scroll',['.creator-header nav > a','.results-heading h1']],
      ]) {
        await page.goto(ui+path); await page.locator(ready).first().waitFor();
        await page.evaluate(() => document.fonts.ready);
        assert.equal(await page.evaluate(() => visualViewport.scale),1);
        assert.ok(await page.evaluate(() => document.fonts.check('500 16px "Creator Open Sans"')));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),name+' page overflow');
        const client = await page.context().newCDPSession(page);
        await client.send('DOM.enable'); await client.send('CSS.enable');
        const {root} = await client.send('DOM.getDocument');
        for (const selector of selectors) {
          const {nodeId} = await client.send('DOM.querySelector',{nodeId:root.nodeId,selector});
          const fonts = await client.send('CSS.getPlatformFontsForNode',{nodeId});
          assert.ok(fonts.fonts.some(font => font.isCustomFont && font.familyName === 'Open Sans'));
          const style = await page.locator(selector).first().evaluate(element => {
            const s = getComputedStyle(element);
            return {size:s.fontSize,weight:s.fontWeight,lineHeight:s.lineHeight,letterSpacing:s.letterSpacing};
          });
          console.log(width,name,selector,style,fonts.fonts.map(font=>font.postScriptName));
        }
        await client.detach();
        if (name === 'builder' || name === 'results') {
          const nav = name === 'builder' ? '.builder-navigation' : '.creator-header nav';
          const tops = await page.locator(nav).evaluate(element => [...element.children].map(child => {
            const text = [...child.childNodes].find(node=>node.nodeType===Node.TEXT_NODE && node.textContent.trim());
            const range = document.createRange(); range.selectNodeContents(text);
            return range.getBoundingClientRect().top;
          }));
          assert.ok(Math.max(...tops)-Math.min(...tops)<1,'primary labels must share a baseline');
        }
        if (name === 'dashboard' && width > 850) {
          const sameRow = await page.locator('.form-card').first().evaluate(card => {
            const a=card.querySelector('.form-card-main').getBoundingClientRect();
            const b=card.querySelector('.form-card-actions').getBoundingClientRect();
            return b.top<a.bottom && b.bottom>a.top;
          });
          assert.ok(sameRow,'actions should remain on compact desktop row');
        }
        await page.screenshot({path:`${output}/creator-${name}-${width}.png`,fullPage:true});
      }
      await page.close();
    }
    console.log('PASS: actual font rendering, baseline alignment, compact rows and mobile containment.');
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
