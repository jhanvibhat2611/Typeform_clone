// Read-only sizing regression. Supply an existing published short-text form URL.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const url = process.env.TEST_PUBLIC_URL;
assert.ok(url, 'Set TEST_PUBLIC_URL to an existing public /f/... route');
const output = process.env.TEST_ARTIFACTS || '.artifacts';
(async () => {
  fs.mkdirSync(output, {recursive:true});
  const browser = await chromium.launch({channel:'msedge', headless:true});
  try {
    for (const [width,height,dpr] of [[1920,900,1],[1280,600,1.5],[390,844,1]]) {
      const page = await browser.newPage({viewport:{width,height},deviceScaleFactor:dpr});
      await page.route('**/*', route => ['GET','HEAD'].includes(route.request().method()) ? route.continue() : route.abort());
      await page.goto(url);
      await page.getByRole('button',{name:'Start',exact:true}).click();
      await page.waitForFunction(() => document.querySelector('.respondent-question')?.getAttribute('aria-busy') === 'false');
      const result = await page.locator('.respondent-question').evaluate(element => {
        const read = node => ({rect:node.getBoundingClientRect().toJSON(),font:parseFloat(getComputedStyle(node).fontSize),zoom:getComputedStyle(node).zoom,transform:getComputedStyle(node).transform});
        return {width:innerWidth,dpr:devicePixelRatio,scale:visualViewport.scale,question:read(element),heading:read(element.querySelector('h1')),
          input:read(element.querySelector('input.preview-answer')),button:read(element.querySelector('.advance')),
          scrolling:element.parentElement.scrollHeight > element.parentElement.clientHeight + 1};
      });
      const near = (actual, expected) => assert.ok(Math.abs(actual-expected)<1, `${actual} should approximate ${expected}`);
      assert.equal(result.scale,1);
      assert.equal(result.question.zoom,'1'); assert.equal(result.question.transform,'none');
      if (width > 600) {
        near(result.input.rect.width*dpr,1080); near(result.question.rect.width*dpr,1080);
        near(result.heading.font*dpr,40); near(result.input.font*dpr,40);
        near(result.button.rect.width*dpr,88); near(result.button.rect.height*dpr,60);
        near(result.input.rect.x*dpr,420); assert.equal(result.scrolling,false);
      } else {
        near(result.heading.font,26); near(result.input.font,26); near(result.button.rect.height,48);
        assert.ok(result.input.rect.right <= width);
      }
      console.log(JSON.stringify(result));
      await page.screenshot({path:`${output}/respondent-sizing-${width}-${dpr}.png`});
      await page.close();
    }
    console.log('PASS: public question sizing at desktop DPR 1 / 1.5 and mobile; no write requests allowed.');
  } finally { await browser.close(); }
})().catch(error => {console.error(error); process.exitCode=1;});
