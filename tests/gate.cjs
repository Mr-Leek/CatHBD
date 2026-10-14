const {chromium,webkit}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.PREVIEW_URL || 'http://localhost:8001/birthday-preview/';
(async()=>{
for(const [name,type,size] of [
 ['chrome',chromium,{width:390,height:844}],
 ['webkit',webkit,{width:390,height:844}],
 ['webkit-landscape',webkit,{width:844,height:390}],
 ['webkit-small',webkit,{width:320,height:568}]
]){
 const browser=await type.launch(name==='chrome'?{headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{headless:true});
 const context=await browser.newContext({viewport:size,isMobile:true,hasTouch:true});
 const page=await context.newPage();const errors=[];let audioRequests=0;
 page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(r.url().endsWith('/music.mp3'))audioRequests++});
 await page.addInitScript(()=>{window.playCalls=0;const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.playCalls++;return play.call(this)};});
 const response=await page.goto(base);const html=await response.text();
 assert.match(html,/<meta name="robots" content="noindex, nofollow, noarchive, noimageindex">/);
 await page.clock.install();await page.clock.runFor(1500);
 const input=page.locator('#gift-password');
 assert.equal(await input.getAttribute('type'),'password');
 assert.equal(await input.getAttribute('inputmode'),'numeric');
 assert.equal(await input.getAttribute('enterkeyhint'),'go');
 assert.equal(await page.locator('#experience').evaluate(el=>el.inert),true);
 assert.equal(await page.locator('#opening').isVisible(),false);
 await page.screenshot({path:`/private/tmp/cathbd-qa/${name}-password-gate.png`});
 for(const value of ['', '00000000','016102026','161020260',' 16102026']){
   await input.fill(value);await input.press('Enter');await page.clock.runFor(1500);
   assert.equal(await page.locator('#password-gate').isVisible(),true);
   assert.equal(await input.getAttribute('aria-invalid'),'true');
   assert.equal(await page.locator('#password-error').innerText(),'That isn’t the secret password. Please try again.');
   assert.equal(await page.locator('#experience').getAttribute('data-state'),'closed');
   assert.equal(await page.locator('#experience').getAttribute('data-scene'),null);
   assert.equal(await page.evaluate(()=>playCalls),0);assert.equal(audioRequests,0);
 }
 await input.fill('16102026');await input.press('Enter');
 await page.clock.runFor(1800);
 assert.equal(await page.locator('#password-gate').isVisible(),false);
 assert.equal(await page.locator('#experience').getAttribute('data-scene'),'birthday-introduction');
 assert.equal(await page.locator('#story-copy').innerText(),'Today is your birthday, and I’ve prepared a little something special for you.');
 assert.equal(await page.evaluate(()=>playCalls),1);assert.equal(audioRequests,1);
 assert.equal(await input.inputValue(),'');
 assert.deepEqual(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length,cookies:document.cookie})),{local:0,session:0,cookies:''});
 await page.reload();await page.clock.runFor(1500);
 assert.equal(await page.locator('#password-gate').isVisible(),true);
 assert.equal(await page.locator('#experience').getAttribute('data-state'),'closed');
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({browser:name,emptyRejected:true,incorrectRejected:true,extraDigitsRejected:true,masked:true,numericKeyboard:true,enterUnlock:true,noEarlyStoryOrAudio:true,noPersistence:true,reloadRelocks:true,noindexInitialHTML:true,errors}));
 await browser.close();
}
})().catch(e=>{console.error(e);process.exit(1)});
