const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = process.env.PREVIEW_URL || 'http://localhost:8001/birthday-preview/';
// A short silent PCM fixture validates playback mechanics, never replaces music.
function wav(){const length=16000;const data=Buffer.alloc(44+length,128);data.write('RIFF');data.writeUInt32LE(36+length,4);data.write('WAVEfmt ',8);data.writeUInt32LE(16,16);data.writeUInt16LE(1,20);data.writeUInt16LE(1,22);data.writeUInt32LE(8000,24);data.writeUInt32LE(8000,28);data.writeUInt16LE(1,32);data.writeUInt16LE(8,34);data.write('data',36);data.writeUInt32LE(length,40);return data;}
(async()=>{
for(const [name,type] of [['chrome',chromium],['webkit',webkit]]){
 const browser=await type.launch(name==='chrome'?{headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'}:{headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.playCalls=0;const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){window.playCalls++;return play.call(this)};});
 await page.route('**/assets/music.mp3',route=>route.fulfill({contentType:'audio/wav',body:wav()}));
 await page.goto(base);await page.locator('#gift-password').fill('16102026');await page.locator('#gift-password').press('Enter');
 await page.waitForFunction(()=>audioAvailable && !audio.paused);
 assert.equal(await page.evaluate(()=>playCalls),1);
 await new Promise(r=>setTimeout(r,2400));
 assert.equal(await page.evaluate(()=>audio.loop && !audio.paused),true);
 assert.equal(await page.evaluate(()=>playCalls),1); // native loop, no new player
 await page.locator('#sound').click();
 assert.equal(await page.evaluate(()=>audio.muted && audio.paused),true);
 await page.locator('#sound').click();
 await page.waitForFunction(()=>!audio.paused);
 await page.locator('#pause').click();
 assert.equal(await page.evaluate(()=>audio.paused),true);
 await page.locator('#pause').click();
 await page.waitForFunction(()=>!audio.paused);
 assert.equal(await page.evaluate(()=>Boolean(audioGain)),true);
 // Exercise the real closing orchestration with browser time and final stop.
 await page.clock.install();
 await page.evaluate(()=>{run++;ending(run)});
 for(let i=0;i<150;i++){
   await page.clock.runFor(1000);
   if(await page.locator('#experience').getAttribute('data-scene')==='fade-to-black'){
     await page.locator('#pause').click();
     const opacity=await page.locator('#cinema').evaluate(el=>getComputedStyle(el).opacity);
     await page.clock.runFor(5000);
     assert.ok(Math.abs(Number(await page.locator('#cinema').evaluate(el=>getComputedStyle(el).opacity))-Number(opacity)) < .02, 'Paused fade must remain visually frozen');
     assert.equal(await page.evaluate(()=>audio.paused),true);
     await page.locator('#pause').click();
     await new Promise(r=>setTimeout(r,3200));
     await page.clock.runFor(5000);break;
   }
 }
 assert.equal(await page.locator('#experience').getAttribute('data-scene'),'complete');
 assert.equal(await page.evaluate(()=>audio.paused && !audio.loop),true);
 await page.locator('#replay').click();await page.clock.runFor(2000);
 await page.waitForFunction(()=>!audio.paused);
 assert.equal(await page.evaluate(()=>audio.loop),true);
 assert.deepEqual(errors,[]);
 // A failed photo becomes a labeled placeholder; the story keeps progressing.
 const missing=await browser.newPage({viewport:{width:390,height:844}});
 await missing.route('**/assets/photos/memory-01.jpg',route=>route.fulfill({status:404,body:'Missing test photo'}));
 await missing.goto(base);await missing.clock.install();await missing.locator('#gift-password').fill('16102026');await missing.locator('#unlock-gift').click();
 for(let i=0;i<35;i++){
   await missing.clock.runFor(1000);
   if(await missing.locator('#experience').getAttribute('data-scene')==='montage-1')break;
 }
 await missing.clock.runFor(2000);
 assert.match(await missing.locator('.photo-layer.visible figcaption').innerText(),/Photo unavailable: Attached photo 2/);
 await missing.clock.runFor(6500);
 assert.equal(await missing.locator('#experience').getAttribute('data-scene'),'montage-2');
 const report={browser:name,fixtureAudioOnly:true,firstTap:true,continuousPlayer:true,loop:true,mute:true,pause:true,finalFadePause:true,finalStop:true,audioReplay:true,missingPhotoFallback:true,errors};
 fs.writeFileSync(`/private/tmp/cathbd-qa/${name}-media.json`,JSON.stringify(report,null,2));console.log(report);
 await browser.close();
}
})().catch(e=>{console.error(e);process.exit(1)});
