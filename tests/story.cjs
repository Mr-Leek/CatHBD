const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const output = '/private/tmp/cathbd-qa';
fs.mkdirSync(output, { recursive: true });
const base = process.env.PREVIEW_URL || 'http://localhost:8001/birthday-preview/';
async function tick(page, ms) { await page.clock.runFor(ms); }
async function runStory(browserType, name, viewport, reducedMotion = 'no-preference') {
  const browser = await browserType.launch(name.startsWith('chrome') ? {executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true} : {headless:true});
  const context = await browser.newContext({ viewport, deviceScaleFactor:1, isMobile:true, hasTouch:true, reducedMotion });
  const page = await context.newPage();
  const errors = [], badAssets = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if(response.status()>=400 && !response.url().endsWith('/music.mp3')) badAssets.push(response.url()); });
  await page.goto(base);
  await page.clock.install();
  await page.evaluate(() => {
    window.seenScenes = []; window.seenCopy = [];
    new MutationObserver(() => {
      const scene = document.getElementById('experience').dataset.scene;
      if (scene && window.seenScenes.at(-1) !== scene) window.seenScenes.push(scene);
      const copy = document.getElementById('story-copy').innerText;
      if (copy && window.seenCopy.at(-1) !== copy) window.seenCopy.push(copy);
    }).observe(document.getElementById('experience'), {subtree:true,attributes:true,childList:true});
  });
  assert.equal(await page.locator('.jewel-stage').isVisible(),false);
  await page.locator('#gift-password').fill('16102026');
  await page.locator('#unlock-gift').click();
  await tick(page,3500);
  assert.equal(await page.locator('#experience').getAttribute('data-scene'),'birthday-introduction');
  assert.equal(await page.locator('.jewel-stage').isVisible(),false);
  // Pausing cannot eat reading time or advance the story.
  await page.locator('#pause').click();
  await tick(page,20000);
  assert.equal(await page.locator('#experience').getAttribute('data-scene'),'birthday-introduction');
  await page.locator('#pause').click();
  const captured = new Set();
  let lastSide = '';
  for (let i=0;i<370;i++) {
    await tick(page,1000);
    const scene = await page.locator('#experience').getAttribute('data-scene');
    if (/montage-[126]|necklace-front|necklace-right|birthday-ending|bai-finale/.test(scene) && !captured.has(scene)) {
      await tick(page,2500);
      await page.screenshot({path:path.join(output,`${name}-${scene}.png`)});
      captured.add(scene);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
      if (scene.startsWith('montage') || scene === 'bai-finale') {
        const geometry = await page.locator('.photo-layer.visible img').evaluate(img=>{
          const a=img.getBoundingClientRect(), b=img.closest('.photo-stage').getBoundingClientRect();
          return {loaded:img.complete && img.naturalWidth>0,fit:getComputedStyle(img).objectFit,inside:a.left>=b.left-1 && a.right<=b.right+1 && a.top>=b.top-1 && a.bottom<=b.bottom+1};
        });
        assert.equal(geometry.loaded,true); assert.equal(geometry.fit,'contain'); assert.equal(geometry.inside,true);
      }
    }
    if (/^necklace-(front|right|back|left)$/.test(scene) && await page.locator('#advance').isEnabled() && scene!==lastSide) {
      const side=scene.split('-')[1];
      const expected={front:-18,right:72,back:162,left:252};
      assert.equal(await page.locator('#pendant').evaluate(el=>el.style.transform),`rotateY(${expected[side]}deg)`);
      assert.equal(await page.locator('.face.current span').textContent(),{front:'Catherine',right:'Cool',back:'Karson',left:'Birthday 2026'}[side]);
      // Ready necklaces wait indefinitely; extra transition taps never skip a face.
      await tick(page,7000);
      assert.equal(await page.locator('#experience').getAttribute('data-scene'),scene);
      await page.locator('#advance').click();
      await page.locator('#advance').evaluate(el=>el.click());
      lastSide=scene;
    }
    if (scene==='complete') break;
  }
  const scenes=await page.evaluate(()=>seenScenes);
  assert.deepEqual(scenes.filter(x=>x.startsWith('montage-')),['montage-1','montage-2','montage-3','montage-4','montage-5','montage-6']);
  assert.deepEqual(scenes.filter(x=>/^necklace-(front|right|back|left)$/.test(x)),['necklace-front','necklace-right','necklace-back','necklace-left']);
  assert.deepEqual(scenes.filter(x=>x.startsWith('why-')),['why-1','why-2','why-3','why-4','why-5','why-6']);
  assert.ok(scenes.indexOf('birthday-ending')<scenes.indexOf('bai-explanation'));
  assert.ok(!scenes.includes('eighth-birthday'));
  assert.ok(!scenes.includes('closing-names') && !scenes.includes('closing-meaning'));
  const copy=await page.evaluate(()=>seenCopy.join('\n'));
  assert.ok(!copy.includes('Four sides.') && !copy.includes('No matter which way life turns'));
  assert.ok(copy.includes('Happy Birthday Catherine') && copy.includes('Karson'));
  assert.equal(scenes.at(-1),'complete');
  await tick(page,1500);
  assert.equal(await page.locator('#replay').isVisible(),true);
  assert.equal(await page.locator('#cinema').isVisible(),false);
  await page.locator('#replay').click(); await tick(page,2000);
  assert.equal(await page.locator('#experience').getAttribute('data-scene'),'birthday-introduction');
  assert.equal(await page.locator('.jewel-stage').isVisible(),false);
  assert.equal(await page.locator('#replay').isVisible(),false);
  assert.deepEqual(errors,[]); assert.deepEqual(badAssets,[]);
  const report={name,viewport,reducedMotion,scenes,errors,badAssets,replay:true,photoBounds:true};
  fs.writeFileSync(path.join(output,`${name}.json`),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
  await browser.close();
}
(async()=>{
  const cases=[
    [chromium,'chrome-portrait',{width:390,height:844}],
    [webkit,'webkit-portrait',{width:390,height:844}],
    [webkit,'webkit-landscape',{width:844,height:390}],
    [webkit,'webkit-small-reduced',{width:320,height:568},'reduce']
  ];
  await Promise.all(cases.filter(c=>!process.env.ONLY || c[1]===process.env.ONLY).map(c=>runStory(...c)));
})().catch(error=>{console.error(error);process.exit(1)});
