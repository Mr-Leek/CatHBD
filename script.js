'use strict';

// The original opening, engraved faces, copy and rotation order are retained.
const CONFIG = {
  names: { front: 'Catherine', back: 'Karson', right: 'Cool', left: 'Birthday 2026' },
  opening: 'For Catherine', openLabel: 'Tap to open', continueLabel: 'Tap to continue',
  birthdayGreeting: 'Happy Birthday Catherine',
  signature: 'Karson',
  steps: [
    { side: 'front', angle: -18, message: 'Your name is on the FRONT, because you’re always at the FRONT of my mind' },
    { side: 'right', angle: 72, message: 'Cool is on the RIGHT, because he’ll always be RIGHT by your side.' },
    { side: 'back', angle: 162, message: 'My name is on the BACK, because I’ll always have your BACK.' },
    { side: 'left', angle: 252, message: 'And your birthday is on the LEFT, because this is one memory I hope will never LEAVE you.' }
  ],
  introduction: 'Today is your birthday, and I’ve prepared a little something special for you.',
  memories: ['This is the eighth birthday we’ve celebrated together.', 'I’m grateful to have you in my life.'],
  family: ['Thank you for bringing Cool and Bai into our world.', 'You, Cool, and Bai are the most meaningful parts of my life.'],
  why: [
    'I wanted to give you something more than just a birthday present.',
    'Something you could wear, and something that would always remind you of the people who love you.',
    'That’s why I chose this necklace.',
    'It has four sides, and each side holds a little meaning.',
    'It’s not just about the necklace itself, but the story behind it.',
    'Now that you’ve seen the necklace, let me tell you what each side means.'
  ],
  baiExplanation: 'And finally, I’m sorry Bai isn’t part of this gift. I had already prepared it before he came into our lives.',
  baiMessage: 'But that doesn’t mean he’s any less special to me.',
  photos: [
    { src: 'assets/photos/memory-01.jpg', alt: 'Catherine and Karson by the water', label: 'Attached photo 2', hold: 3800 },
    { src: 'assets/photos/memory-02.jpg', alt: 'Catherine and Karson sharing a quiet moment', label: 'Attached photo 3', hold: 3800 },
    { src: 'assets/photos/memory-03.jpg', alt: 'Catherine and Karson on a boat', label: 'Attached photo 4', hold: 3800 },
    { src: 'assets/photos/memory-04.jpg', alt: 'Catherine and Karson in an orchard', label: 'Attached photo 5', hold: 5000 },
    { src: 'assets/photos/cool.jpg', alt: 'Cool looking out of a car window', label: 'Attached photo 6 — Cool', hold: 6000 },
    { src: 'assets/photos/bai-family.jpg', alt: 'Catherine holding Bai and Cool', label: 'Attached photo 7 — Bai, Cool and Catherine', hold: 6500 }
  ],
  baiPhoto: { src: 'assets/photos/bai-finale.jpg', alt: 'Bai resting on a soft white blanket', label: 'Attached photo 1 — Bai' },
  replay: 'Replay', soundOn: 'Sound on', soundOff: 'Sound off',
  audio: 'assets/music.mp3', audioTitle: 'Sentimental Piano – Grand_Project',
  timing: { opening: 1200, pendantReveal: 1500, transition: 1600, fade: 650 }
};

const $ = id => document.getElementById(id);
const root = $('experience');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const audio = new Audio();
audio.preload = 'none';
audio.volume = 0;
audio.loop = true;
let stepIndex = -1, transitioning = false, completed = false, started = false;
let unlocked = false;
let soundWanted = true, audioFailed = false, audioAvailable = false;
let userPaused = false, run = 0, activePhoto = -1, volumeFrame;
let audioContext, audioGain, audioSource;
let pausedAnimations = [];
let loopFading = false, lastAudioTime = 0;
const imageLoads = new Map();
const motion = ms => reducedMotion.matches ? Math.min(ms, 450) : ms;
const isPaused = () => userPaused || document.hidden;

// Scene clocks stop while paused or backgrounded; no hidden-tab scene skipping.
function wait(ms, token = run) {
  return new Promise(resolve => {
    let remaining = ms, last = performance.now();
    function tick(now) {
      if (token !== run) { resolve(false); return; }
      if (!isPaused()) remaining -= Math.min(now - last, 100);
      last = now;
      if (!isPaused() && remaining <= 0) resolve(true);
      else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}
function initAudioGraph() {
  // A gain node provides real fades on iPhone, where media.volume is fixed.
  try {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    audioContext ||= new Context();
    if (!audioSource) {
      audioSource = audioContext.createMediaElementSource(audio);
      audioGain = audioContext.createGain();
      audioGain.gain.value = 0;
      audioSource.connect(audioGain).connect(audioContext.destination);
    }
    audio.volume = 1;
    audioContext.resume().catch(() => {});
  } catch { /* Older browsers retain the media-element fade. */ }
}
function fadeVolume(target, duration = 1800) {
  cancelAnimationFrame(volumeFrame);
  if (audioGain) {
    const now = audioContext.currentTime;
    audioGain.gain.cancelScheduledValues(now);
    audioGain.gain.setValueAtTime(audioGain.gain.value, now);
    audioGain.gain.linearRampToValueAtTime(target, now + duration / 1000);
    return;
  }
  const start = performance.now(), initial = audio.volume;
  function tick(now) {
    const fraction = Math.min((now - start) / duration, 1);
    audio.volume = initial + (target - initial) * fraction;
    if (fraction < 1) volumeFrame = requestAnimationFrame(tick);
  }
  volumeFrame = requestAnimationFrame(tick);
}
function updateSound() {
  $('sound').hidden = !started || !audioAvailable || audioFailed || completed;
  $('sound').textContent = soundWanted ? CONFIG.soundOn : CONFIG.soundOff;
  $('sound').setAttribute('aria-pressed', String(soundWanted));
  $('sound').setAttribute('aria-label', soundWanted ? 'Mute music' : 'Unmute music');
}
function startAudio() {
  if (audioFailed || !soundWanted || completed || isPaused()) return;
  if (!audio.src) audio.src = CONFIG.audio;
  const token = run;
  audioContext?.resume().catch(() => {});
  // This call runs synchronously inside the first tap, before any scene awaits.
  audio.play().then(() => {
    audioAvailable = true;
    if (token !== run || !soundWanted || completed || isPaused()) { audio.pause(); return; }
    updateSound();
    if (root.dataset.state !== 'fading') fadeVolume(.18);
  }).catch(() => { updateSound(); });
}
audio.addEventListener('error', () => { audioFailed = true; audioAvailable = false; updateSound(); });
audio.addEventListener('canplay', () => { audioAvailable = true; updateSound(); });
// Ease down before a native loop, then up after it wraps, without replacing or
// restarting the player between scenes. Keep the final fade's envelope intact.
audio.addEventListener('timeupdate', () => {
  if (!started || completed || !soundWanted || isPaused() || root.dataset.state === 'fading') return;
  const time = audio.currentTime, remaining = audio.duration - time;
  if (time < lastAudioTime) { loopFading = false; fadeVolume(.18, 1600); }
  if (Number.isFinite(remaining) && remaining < 2 && remaining > 0 && !loopFading) {
    loopFading = true; fadeVolume(0, remaining * 1000);
  }
  lastAudioTime = time;
});
$('sound').addEventListener('click', () => {
  soundWanted = !soundWanted;
  audio.muted = !soundWanted; // Native mute also works on iPhone Safari.
  if (soundWanted) startAudio();
  else audio.pause();
  updateSound();
});
function syncPause() {
  if (isPaused()) {
    for (const animation of root.getAnimations({ subtree: true })) {
      if (animation.playState === 'running') { animation.pause(); pausedAnimations.push(animation); }
    }
  } else {
    pausedAnimations.forEach(animation => { if (animation.playState === 'paused') animation.play(); });
    pausedAnimations = [];
  }
  root.classList.toggle('paused', isPaused());
  $('pause').textContent = userPaused ? 'Resume' : 'Pause';
  $('pause').setAttribute('aria-pressed', String(userPaused));
  if (isPaused()) { audio.pause(); audioContext?.suspend().catch(() => {}); }
  else if (started) startAudio();
}
$('pause').addEventListener('click', () => { userPaused = !userPaused; syncPause(); });
document.addEventListener('visibilitychange', syncPause);

function loadImage(photo) {
  if (!imageLoads.has(photo.src)) {
    imageLoads.set(photo.src, new Promise(resolve => {
      const image = new Image();
      let settled = false;
      const finish = ok => { if (!settled) { settled = true; clearTimeout(timeout); resolve(ok); } };
      const timeout = setTimeout(() => finish(false), 12000);
      image.onload = async () => {
        try { await image.decode(); } catch { /* onload confirms usable pixels */ }
        finish(true);
      };
      image.onerror = () => finish(false);
      image.src = photo.src;
    }));
  }
  return imageLoads.get(photo.src);
}
function setCopy(lines, title = false) {
  $('story-copy').replaceChildren(...lines.map((text, i) => {
    const node = document.createElement(title && i === 0 ? 'h1' : 'p');
    node.textContent = text;
    if (text === CONFIG.signature) node.className = 'signature';
    return node;
  }));
}
async function textScene(lines, hold, token, { title = false, id = 'text' } = {}) {
  root.dataset.scene = id;
  root.dataset.state = 'cinema';
  $('cinema').hidden = false;
  $('cinema').classList.remove('with-photo', 'final-photo');
  $('cinema').dataset.layout = id;
  $('story-copy').classList.remove('visible');
  setCopy(lines, title);
  void $('story-copy').offsetWidth;
  $('story-copy').classList.add('visible');
  if (!await wait(motion(850) + hold, token)) return false;
  $('story-copy').classList.remove('visible');
  return wait(motion(650) + 180, token);
}
async function showPhoto(photo, duration, fade, token) {
  const ok = await loadImage(photo);
  if (token !== run || !await wait(0, token)) return false;
  const layers = [...document.querySelectorAll('.photo-layer')];
  const next = (activePhoto + 1) % layers.length;
  const layer = layers[next], image = layer.querySelector('img');
  layer.classList.remove('visible', 'zooming');
  layer.style.setProperty('--photo-time', `${duration}ms`);
  layer.style.setProperty('--photo-fade', `${motion(fade)}ms`);
  image.hidden = !ok;
  const caption = layer.querySelector('figcaption');
  caption.hidden = ok;
  caption.textContent = ok ? '' : `Photo unavailable: ${photo.label}`;
  image.alt = photo.alt;
  if (ok) image.src = photo.src;
  else image.removeAttribute('src');
  // Restart only the entering photograph's zoom, never the outgoing image.
  void layer.offsetWidth;
  layer.classList.add('zooming', 'visible');
  if (activePhoto >= 0) {
    layers[activePhoto].style.setProperty('--photo-fade', `${motion(fade)}ms`);
    layers[activePhoto].classList.remove('visible');
  }
  activePhoto = next;
  return wait(motion(fade), token);
}
async function montage(token) {
  $('cinema').hidden = false;
  $('cinema').classList.add('with-photo');
  $('photo-stage').hidden = false;
  setCopy(CONFIG.memories);
  $('story-copy').classList.remove('visible');
  for (let i = 0; i < CONFIG.photos.length; i++) {
    const photo = CONFIG.photos[i];
    root.dataset.scene = `montage-${i + 1}`;
    if (i === 4) {
      $('story-copy').classList.remove('visible');
      if (!await wait(motion(900), token)) return false;
      setCopy(CONFIG.family);
      $('story-copy').classList.add('visible');
    }
    if (CONFIG.photos[i + 1]) loadImage(CONFIG.photos[i + 1]);
    const fade = i === 0 ? 1500 : 1200;
    if (i === 0) {
      await loadImage(photo);
      if (token !== run || !await wait(0, token)) return false;
      void $('story-copy').offsetWidth;
      $('story-copy').classList.add('visible');
    }
    if (!await showPhoto(photo, fade + photo.hold + 1200, fade, token)) return false;
    if (!await wait(photo.hold, token)) return false;
  }
  $('cinema').classList.add('faded');
  if (!await wait(motion(1800) + 600, token)) return false;
  resetPhotos();
  $('story-copy').classList.remove('visible');
  $('cinema').classList.remove('faded', 'with-photo');
  return true;
}
function resetPhotos() {
  $('photo-stage').hidden = true;
  document.querySelectorAll('.photo-layer').forEach(layer => layer.classList.remove('visible', 'zooming'));
  activePhoto = -1;
}
function renderMessage(text = '') {
  $('message').replaceChildren();
  text.split(/(FRONT|BACK|RIGHT|LEFT|LEAVE|\n)/g).forEach(part => {
    if (part === '\n') $('message').append(document.createElement('br'));
    else if (/^(FRONT|BACK|RIGHT|LEFT|LEAVE)$/.test(part)) {
      const emphasis = document.createElement('em'); emphasis.textContent = part; $('message').append(emphasis);
    } else $('message').append(document.createTextNode(part));
  });
}
function setTransitioning(value) {
  transitioning = value;
  $('advance').disabled = value;
  $('tap-hint').classList.toggle('ready', !value && !completed && root.dataset.state === 'playing');
}
async function revealStep(index, token = run) {
  setTransitioning(true);
  $('chapter').classList.remove('visible');
  if (stepIndex >= 0 && !await wait(CONFIG.timing.fade, token)) return;
  stepIndex = index;
  const step = CONFIG.steps[index];
  root.dataset.state = 'playing'; root.dataset.scene = `necklace-${step.side}`;
  $('cinema').hidden = true; $('pause').hidden = true;
  document.querySelector('.jewel-stage').classList.remove('leaving');
  document.querySelector('.jewel-stage').hidden = false;
  $('engraving').hidden = true; $('message').hidden = false;
  renderMessage(step.message);
  document.querySelectorAll('.face').forEach(face => face.classList.toggle('current', face.classList.contains(step.side)));
  $('progress').hidden = false;
  document.querySelectorAll('.progress span').forEach((mark, i) => mark.classList.toggle('active', index === i));
  $('pendant').style.transform = `rotateY(${step.angle}deg)`;
  if (!await wait(motion(index === 0 ? CONFIG.timing.pendantReveal : CONFIG.timing.transition), token)) return;
  $('chapter').classList.add('visible');
  if (!await wait(CONFIG.timing.fade, token)) return;
  $('advance').hidden = false;
  setTransitioning(false);
  $('advance').focus({ preventScroll: true });
}
async function playStory(token, first) {
  if (!await wait(first ? motion(CONFIG.timing.opening) : 300, token)) return;
  $('opening').hidden = true;
  if (!await textScene([CONFIG.introduction], 4800, token, { id: 'birthday-introduction' })) return;
  if (!await montage(token)) return;
  for (let i = 0; i < CONFIG.why.length; i++) {
    const hold = i === 2 ? 5500 : i === 1 ? 6500 : i === 5 ? 6000 : 5000;
    if (!await textScene([CONFIG.why[i]], hold, token, { id: `why-${i + 1}` })) return;
  }
  await revealStep(0, token);
}
async function ending(token) {
  setTransitioning(true); $('advance').hidden = true;
  $('chapter').classList.remove('visible'); $('progress').hidden = true;
  root.dataset.state = 'closing'; root.dataset.scene = 'necklace-outro';
  document.querySelector('.jewel-stage').classList.add('leaving');
  if (!await wait(motion(1500), token)) return;
  document.querySelector('.jewel-stage').hidden = true;
  $('pause').hidden = false;
  if (!await textScene([CONFIG.birthdayGreeting, CONFIG.signature], 5500, token, { title: true, id: 'birthday-ending' })) return;
  if (!await wait(1000, token)) return;
  if (!await textScene([CONFIG.baiExplanation], 9000, token, { id: 'bai-explanation' })) return;
  root.dataset.scene = 'bai-finale';
  $('cinema').classList.add('with-photo', 'final-photo'); $('photo-stage').hidden = false;
  setCopy([CONFIG.baiMessage]); $('story-copy').classList.add('visible');
  if (!await showPhoto(CONFIG.baiPhoto, 12000, 2000, token)) return;
  if (!await wait(6500, token)) return;
  root.dataset.state = 'fading'; root.dataset.scene = 'fade-to-black';
  $('cinema').classList.add('final-fade');
  fadeVolume(0, 3000);
  if (!await wait(3000, token)) return;
  completed = true; audio.pause(); audio.loop = false;
  $('cinema').hidden = true; $('pause').hidden = true;
  root.dataset.state = 'complete'; root.dataset.scene = 'complete';
  updateSound();
  if (!await wait(900, token)) return;
  $('replay').hidden = false; $('replay').focus({ preventScroll: true });
}
function begin() {
  if (!unlocked) return;
  if (started && !completed) return;
  const first = !started;
  run++; started = true; completed = false; userPaused = false; stepIndex = -1;
  root.classList.remove('paused'); root.dataset.state = 'cinema'; root.dataset.scene = 'opening';
  $('cinema').classList.remove('with-photo', 'final-photo', 'faded', 'final-fade');
  $('story-copy').classList.remove('visible'); resetPhotos();
  $('chapter').classList.remove('visible'); $('progress').hidden = true;
  document.querySelector('.jewel-stage').hidden = true;
  $('opening').classList.add('dismissed'); $('opening').disabled = true;
  $('advance').hidden = true; $('replay').hidden = true; $('pause').hidden = false;
  $('pause').textContent = 'Pause'; $('pause').setAttribute('aria-pressed', 'false');
  setTransitioning(true);
  audio.loop = true; loopFading = false; lastAudioTime = 0;
  if (!audioFailed) { audio.currentTime = 0; initAudioGraph(); fadeVolume(0, 0); }
  startAudio();
  loadImage(CONFIG.photos[0]); loadImage(CONFIG.photos[1]); loadImage(CONFIG.baiPhoto);
  playStory(run, first);
}
$('opening').addEventListener('click', begin);
// A surprise screen only: the password is necessarily visible in public code.
// Keep it as a string, and store only an in-memory unlocked flag for this page.
$('unlock-form').addEventListener('submit', event => {
  event.preventDefault();
  if (unlocked) return;
  const input = $('gift-password');
  if (input.value !== '16102026') {
    input.setAttribute('aria-invalid', 'true');
    $('password-error').textContent = 'That isn’t the secret password. Please try again.';
    input.focus({ preventScroll: true });
    return;
  }
  unlocked = true;
  input.value = '';
  input.removeAttribute('aria-invalid');
  $('password-error').textContent = '';
  $('unlock-gift').disabled = true;
  $('password-gate').inert = true;
  $('password-gate').classList.add('dismissed');
  root.inert = false;
  root.removeAttribute('aria-hidden');
  // Begin synchronously in the submit gesture, before the gate's fade awaits,
  // so play() and AudioContext.resume() retain iPhone's user activation.
  begin();
  setTimeout(() => {
    $('password-gate').hidden = true;
    if (!completed) $('pause').focus({ preventScroll: true });
  }, reducedMotion.matches ? 450 : 900);
});
$('gift-password').addEventListener('input', () => {
  $('gift-password').removeAttribute('aria-invalid');
  $('password-error').textContent = '';
});
$('advance').addEventListener('click', () => {
  if (transitioning || completed || stepIndex < 0) return;
  if (stepIndex < CONFIG.steps.length - 1) revealStep(stepIndex + 1);
  else ending(run);
});
$('replay').addEventListener('click', begin);
$('dedication').textContent = CONFIG.opening; $('open-label').textContent = CONFIG.openLabel;
$('tap-hint').textContent = CONFIG.continueLabel; $('advance').setAttribute('aria-label', CONFIG.continueLabel);
$('replay').textContent = CONFIG.replay;
Object.entries(CONFIG.names).forEach(([side, name]) => { document.querySelector(`.face.${side} span`).textContent = name; });
document.documentElement.style.setProperty('--pendant-reveal', `${motion(CONFIG.timing.pendantReveal)}ms`);
document.documentElement.style.setProperty('--turn', `${CONFIG.timing.transition}ms`);
document.documentElement.style.setProperty('--fade', `${CONFIG.timing.fade}ms`);
$('progress').hidden = true;
updateSound();
