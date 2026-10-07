# For Catherine

A dependency-free birthday experience. Open `index.html`, or serve this folder with any static web server. Publish the folder to GitHub Pages and point your printed QR code at the published URL.

Edit the labelled CONFIG object at the top of script.js for names, messages and transition timing. The opening tap reveals “Happy Birthday Catherine”. This greeting and the following introduction show only centered text; the necklace first appears with the FRONT message. Each following tap reveals exactly one of the remaining five paragraphs; the pendant turns when the corresponding engraved side changes. Nothing advances on a timer. Extra taps during a transition are ignored. Tap anywhere in the main page to continue, or use Tab and Enter/Space. The final LEFT paragraph stays visible and offers Replay.

Optional audio: add assets/music.mp3. Missing audio never blocks the story and the sound control stays hidden when no track is available. Audio starts on the opening tap; the track repeats only if it ends before the final paragraph. iOS may enforce device volume instead of scripted volume fades.

The engraved chapters run FRONT → RIGHT → BACK → LEFT. The side names belong to the pendant itself: FRONT Catherine, RIGHT Cool, BACK Karson, LEFT Birthday 2026. The side-face geometry is fixed, with a +90-degree rotation between engraved chapters; labels do not move to follow screen position. Reduced motion replaces rotation with simple fades.
