'use strict';

// EDIT YOUR GIFT HERE. Each entry in steps is revealed by one tap.
const CONFIG = {
  // Face names belong to the pendant itself, independently of screen position.
  names: { front: 'Catherine', back: 'Karson', right: 'Cool', left: 'Birthday 2026' },
  opening: 'For Catherine',
  openLabel: 'Tap to open',
  continueLabel: 'Tap to continue',
  // Chapters follow FRONT → RIGHT → BACK → LEFT.
  // Matching the fixed model faces: each tap rotates +90 degrees.
  steps: [
    { title: 'Happy Birthday Catherine' },
    { message: 'Now that you’ve seen the necklace,\nthere’s a little meaning behind each side.' },
    { side: 'front', angle: -18, message: 'Your name is on the FRONT, because you’re always at the FRONT of my mind' },
    { side: 'right', angle: 72, message: 'Cool is on the RIGHT, because he’ll always be RIGHT by your side.' },
    { side: 'back', angle: 162, message: 'My name is on the BACK, because I’ll always have your BACK.' },
    // Change the final birthday message here.
    { side: 'left', angle: 252, message: 'And your birthday is on the LEFT, because this is one memory I hope will never LEAVE you.' }
  ],
  replay: 'Replay', soundOn: 'Sound on', soundOff: 'Sound off',
  audio: 'assets/music.mp3',
  timing: {
    opening: 1200, // Fade out the opening screen after the first tap.
    pendantReveal: 1500, // First show the necklace when the FRONT chapter begins.
    transition: 1600, // Rotate to the next engraved face after a tap.
    fade: 650 // Fade between paragraphs. Nothing advances automatically.
  }
};

const $ = id => document.getElementById(id);
const root = $('experience');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const audio = new Audio();
audio.preload = 'none';
audio.volume = 0;
let stepIndex = -1;
let transitioning = false;
let completed = false;
let soundWanted = true;
let audioFailed = false;
let audioStarted = false;
let audioAvailable = false;
let volumeFrame;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

function fadeVolume(target, duration = 1800) {
  cancelAnimationFrame(volumeFrame);
  const start = performance.now(), initial = audio.volume;
  const tick = now => {
    const fraction = Math.min((now - start) / duration, 1);
    audio.volume = initial + (target - initial) * fraction;
    if (fraction < 1) volumeFrame = requestAnimationFrame(tick);
  };
  volumeFrame = requestAnimationFrame(tick);
}
function updateSound() {
  // An absent soundtrack never leaves a label or empty control on screen.
  $('sound').hidden = !audioAvailable || audioFailed || stepIndex < 0;
  $('sound').textContent = audioStarted && soundWanted ? CONFIG.soundOn : CONFIG.soundOff;
  $('sound').setAttribute('aria-pressed', String(audioStarted && soundWanted && !audioFailed));
}
function audioFailure() {
  audioFailed = true;
  audioStarted = false;
  cancelAnimationFrame(volumeFrame);
  updateSound();
}
audio.addEventListener('error', audioFailure);
audio.addEventListener('canplay', () => { audioAvailable = true; updateSound(); });
audio.addEventListener('ended', () => {
  if (stepIndex >= 0 && !completed && soundWanted) {
    audio.currentTime = 0;
    startAudio();
  } else {
    audioStarted = false;
    updateSound();
  }
});
function startAudio() {
  if (audioFailed || !soundWanted) return;
  if (!audio.src) audio.src = CONFIG.audio;
  // Keep play() in the opening tap for iPhone's media permission.
  audio.play().then(() => {
    audioAvailable = true;
    if (!soundWanted || document.hidden) { audio.pause(); return; }
    audioStarted = true;
    updateSound();
    fadeVolume(completed ? .08 : .18);
  }).catch(() => { audioStarted = false; updateSound(); });
}
$('sound').addEventListener('click', () => {
  soundWanted = !soundWanted;
  if (soundWanted) startAudio();
  else { cancelAnimationFrame(volumeFrame); audio.pause(); audioStarted = false; }
  updateSound();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio.pause();
  else if (soundWanted && audioStarted && !audioFailed) startAudio();
});

function renderMessage(text = '') {
  $('message').replaceChildren();
  // Preserve the supplied wording and emphasize each positional word.
  text.split(/(FRONT|BACK|RIGHT|LEFT|LEAVE|\n)/g).forEach(part => {
    if (part === '\n') $('message').append(document.createElement('br'));
    else if (/^(FRONT|BACK|RIGHT|LEFT|LEAVE)$/.test(part)) {
      const emphasis = document.createElement('em');
      emphasis.textContent = part;
      $('message').append(emphasis);
    } else $('message').append(document.createTextNode(part));
  });
}
function showStep(step) {
  // Birthday and introduction are text-only, including after Replay.
  root.dataset.state = step.side ? 'playing' : 'intro';
  document.querySelector('.jewel-stage').hidden = !step.side;
  $('engraving').textContent = step.title || '';
  $('engraving').hidden = !step.title;
  $('message').hidden = !step.message;
  renderMessage(step.message);
  $('chapter').classList.toggle('greeting', Boolean(step.title));
  const side = step.side || 'front';
  document.querySelectorAll('.face').forEach(face => face.classList.toggle('current', face.classList.contains(side)));
  // Progress follows the chapter order, independently of the physical face map.
  const sideIndex = CONFIG.steps.filter(item => item.side).findIndex(item => item.side === step.side);
  $('progress').hidden = sideIndex < 0;
  document.querySelectorAll('.progress span').forEach((mark, index) => mark.classList.toggle('active', index === sideIndex));
}
function setTransitioning(value) {
  transitioning = value;
  $('advance').disabled = value;
  $('tap-hint').classList.toggle('ready', !value && !completed);
}
async function revealStep(index, opening = false) {
  setTransitioning(true);
  $('chapter').classList.remove('visible');
  $('replay').hidden = true;
  const step = CONFIG.steps[index];
  if (!opening) await wait(CONFIG.timing.fade);
  const previousStep = CONFIG.steps[stepIndex];
  const previousAngle = previousStep?.angle ?? -18;
  stepIndex = index;
  completed = index === CONFIG.steps.length - 1;
  showStep(step);
  $('pendant').style.transform = `rotateY(${step.angle ?? -18}deg)`;
  if (opening) {
    await wait(CONFIG.timing.opening);
    $('opening').hidden = true;
  } else if (step.side && !previousStep?.side) {
    // Reveal the pendant only for FRONT, after both text-only introduction taps.
    await wait(reducedMotion.matches ? CONFIG.timing.fade : CONFIG.timing.pendantReveal);
  } else if (step.side && step.angle !== previousAngle && !reducedMotion.matches) {
    await wait(CONFIG.timing.transition);
  }
  $('chapter').classList.add('visible');
  // Ignore extra taps during the reveal; never queue up skipped paragraphs.
  await wait(CONFIG.timing.fade);
  setTransitioning(false);
  $('advance').hidden = completed;
  $('replay').hidden = !completed;
  if (completed) {
    if (audioStarted) fadeVolume(.08);
    $('replay').focus({ preventScroll: true });
  } else $('advance').focus({ preventScroll: true });
}
function begin() {
  if (transitioning) return;
  setTransitioning(true);
  completed = false;
  root.dataset.state = 'intro';
  document.querySelector('.jewel-stage').hidden = true;
  $('opening').classList.add('dismissed');
  $('opening').disabled = true;
  $('advance').hidden = false;
  $('replay').hidden = true;
  if (!audioFailed) { audio.currentTime = 0; audio.volume = 0; }
  startAudio();
  revealStep(0, stepIndex < 0);
}
$('opening').addEventListener('click', begin);
$('advance').addEventListener('click', () => {
  if (!transitioning && !completed && stepIndex >= 0) revealStep(stepIndex + 1);
});
$('replay').addEventListener('click', begin);
$('dedication').textContent = CONFIG.opening;
$('open-label').textContent = CONFIG.openLabel;
$('tap-hint').textContent = CONFIG.continueLabel;
$('advance').setAttribute('aria-label', CONFIG.continueLabel);
$('replay').textContent = CONFIG.replay;
Object.entries(CONFIG.names).forEach(([side, name]) => {
  document.querySelector(`.face.${side} span`).textContent = name;
});
document.documentElement.style.setProperty('--pendant-reveal', `${CONFIG.timing.pendantReveal}ms`);
document.documentElement.style.setProperty('--turn', `${CONFIG.timing.transition}ms`);
document.documentElement.style.setProperty('--fade', `${CONFIG.timing.fade}ms`);
updateSound();
