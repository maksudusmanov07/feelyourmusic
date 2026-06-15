let fft, sound;
let bassEnv = 0;
let bassAvg = 0;
let transientEnv = 0;
let melodyEnv = 0;
let spinAngle = 0;
let colorIndex = 0;
let wasKicking = false;
let curR = 57, curG = 255, curB = 20;
let orbR = 15, orbG = 240, orbB = 252;
let sparkles = [];
let flashAlpha = 0;
let kickFlash = 0;
let trackName = '';
let countdown = 0;
let countdownAt = 0;

let vizLayer;
let cameraLayer;
let mainCanvas;

// camera
let capture = null;
let facingMode = 'user';

// recording
let isRecording = false;
let recorder = null;
let recordChunks = [];
let recordStart = 0;
const RECORD_DURATION = 15000;
let audioRecordDest = null;

// seek slider
let seekSlider;
let seekingSlider = false;
let lastSliderUpdate = 0;

const themes = {
  neon:   [[57,255,20],  [255,16,240],  [15,240,252],  [255,255,0],   [255,102,0]],
  fire:   [[255,60,0],   [255,160,0],   [255,220,20],  [220,20,20],   [255,100,0]],
  ocean:  [[0,220,255],  [0,120,255],   [0,255,190],   [80,180,255],  [0,180,220]],
  purple: [[180,0,255],  [255,0,200],   [140,0,255],   [255,80,255],  [100,0,220]],
  mono:   [[255,255,255],[210,210,210], [240,240,240],  [180,180,180], [225,225,225]],
};

let neonColors = themes.neon;

function startCamera(mode) {
  if (capture) {
    const stream = capture.elt.srcObject;
    if (stream) stream.getTracks().forEach(t => t.stop());
    capture.remove();
    capture = null;
  }
  if (cameraLayer) cameraLayer.clear(); // clear trail when switching cameras
  capture = createCapture({ video: { facingMode: { ideal: mode } }, audio: false });
  capture.size(800, 800);
  capture.hide();
  facingMode = mode;
}

function setup() {
  const cnv = createCanvas(800, 800);
  cnv.style('display', 'block');
  mainCanvas = cnv.elt;

  fft = new p5.FFT(0.85, 2048);
  vizLayer    = createGraphics(800, 800);
  cameraLayer = createGraphics(800, 800);

  startCamera('user');

  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      neonColors = themes[btn.dataset.theme];
    });
  });

  document.getElementById('fileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    trackName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    const url = URL.createObjectURL(file);
    if (sound) sound.stop();
    userStartAudio();
    const audioCtx = getAudioContext();
    if (!audioRecordDest) audioRecordDest = audioCtx.createMediaStreamDestination();
    sound = loadSound(url, () => {
      sound.play();
      fft.setInput(sound);
      try { sound.output.connect(audioRecordDest); } catch (e) {}
      seekSlider.max = sound.duration();
      seekSlider.value = 0;
    });
  });

  seekSlider = document.getElementById('seek-slider');
  seekSlider.addEventListener('mousedown',  () => { seekingSlider = true; });
  seekSlider.addEventListener('touchstart', () => { seekingSlider = true; }, { passive: true });
  seekSlider.addEventListener('mouseup', () => {
    seekingSlider = false;
    if (sound && sound.isLoaded()) sound.jump(parseFloat(seekSlider.value));
  });
  seekSlider.addEventListener('touchend', () => {
    seekingSlider = false;
    if (sound && sound.isLoaded()) sound.jump(parseFloat(seekSlider.value));
  });

  document.getElementById('camera-btn').addEventListener('click', () => {
    startCamera(facingMode === 'user' ? 'environment' : 'user');
  });

  document.getElementById('record-btn').addEventListener('click', () => {
    isRecording ? stopRecording() : startRecording();
  });
}

function startRecording() {
  if (isRecording) return;
  let stream;
  try {
    const videoStream = mainCanvas.captureStream(30);
    const tracks = [...videoStream.getVideoTracks()];
    if (audioRecordDest) tracks.push(...audioRecordDest.stream.getAudioTracks());
    stream = new MediaStream(tracks);
  } catch (e) {
    alert('Recording not supported on this browser.');
    return;
  }
  const types = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    '',
  ];
  const mimeType = types.find(t => !t || MediaRecorder.isTypeSupported(t)) || '';
  recordChunks = [];
  try {
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
  } catch (e) {
    alert('Recording not supported on this browser.');
    return;
  }
  recorder.ondataavailable = (e) => { if (e.data.size > 0) recordChunks.push(e.data); };
  recorder.onstop = () => {
    const actualType = recorder.mimeType || mimeType;
    const ext = actualType.includes('webm') ? 'webm' : 'mp4';
    const blobType = actualType || (ext === 'mp4' ? 'video/mp4' : 'video/webm');
    const blob = new Blob(recordChunks, { type: blobType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `feelyourmusic.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
    isRecording = false;
    document.getElementById('record-btn').textContent = '● rec';
    document.getElementById('record-btn').classList.remove('recording');
  };
  recorder.start();
  isRecording = true;
  recordStart = millis();
  document.getElementById('record-btn').textContent = '■ stop';
  document.getElementById('record-btn').classList.add('recording');
  setTimeout(() => { if (recorder && recorder.state === 'recording') stopRecording(); }, RECORD_DURATION);
}

function stopRecording() {
  if (recorder && recorder.state === 'recording') recorder.stop();
}

function keyPressed() {
  if (key === ' ' && countdown === 0) {
    countdown = 5;
    countdownAt = millis();
  }
}

function draw() {
  background(11, 11, 13);
  translate(width / 2, height / 2);

  // update seek slider ~10x/sec
  if (!seekingSlider && sound && sound.isPlaying() && millis() - lastSliderUpdate > 100) {
    const t = sound.currentTime();
    if (isFinite(t) && t >= 0) seekSlider.value = t;
    lastSliderUpdate = millis();
  }

  // motion blur camera — draw new frame at 75% opacity over old frame (no clear)
  // still frames = crisp, fast movement = soft trail
  if (capture && capture.elt.readyState >= 2) {
    cameraLayer.push();
    if (facingMode === 'user') {
      cameraLayer.translate(width, 0);
      cameraLayer.scale(-1, 1);
    }
    cameraLayer.tint(255, 190); // 75% new, 25% old = subtle motion trail
    cameraLayer.image(capture, 0, 0, width, height);
    cameraLayer.noTint();
    cameraLayer.pop();
  }

  // draw camera: 5px glow layer under sharp layer
  drawingContext.filter = 'blur(5px)';
  tint(255, 90);
  image(cameraLayer, -width / 2, -height / 2);
  noTint();
  drawingContext.filter = 'none';
  image(cameraLayer, -width / 2, -height / 2);


  if (!sound || !sound.isPlaying()) {
    fill(255, 255, 255, 55);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(13);
    text('load a track', 0, 340);
    return;
  }

  const spectrum = fft.analyze();

  const bass = fft.getEnergy('bass') / 255;
  bassEnv = lerp(bassEnv, bass, bass > bassEnv ? 0.35 : 0.04);
  bassAvg = lerp(bassAvg, bassEnv, 0.003);

  const rawTransient = max(0, bassEnv - bassAvg);
  // faster attack (0.7) so it catches kicks sharper
  transientEnv = lerp(transientEnv, rawTransient, rawTransient > transientEnv ? 0.7 : 0.08);

  const mid = fft.getEnergy('mid') / 255;
  melodyEnv = lerp(melodyEnv, mid, mid > melodyEnv ? 0.3 : 0.05);

  const isKicking = transientEnv > 0.05;
  if (isKicking && !wasKicking) {
    colorIndex = (colorIndex + 1) % neonColors.length;
    kickFlash = 1.0; // trigger kick flash
    const spawnR = min(80 + bassEnv * 50 + transientEnv * 220, 260);
    for (let i = 0; i < 14; i++) {
      const a = random(TWO_PI);
      sparkles.push({
        x: cos(a) * (spawnR + random(30, 100)),
        y: sin(a) * (spawnR + random(30, 100)),
        vx: cos(a) * random(2, 5),
        vy: sin(a) * random(2, 5),
        life: 1.0,
        decay: random(0.02, 0.045),
        size: random(1.5, 3.5),
      });
    }
  }
  wasKicking = isKicking;

  const [tarR, tarG, tarB] = neonColors[colorIndex];
  curR = lerp(curR, tarR, 0.08);
  curG = lerp(curG, tarG, 0.08);
  curB = lerp(curB, tarB, 0.08);

  const [tarOR, tarOG, tarOB] = neonColors[(colorIndex + 2) % neonColors.length];
  orbR = lerp(orbR, tarOR, 0.08);
  orbG = lerp(orbG, tarOG, 0.08);
  orbB = lerp(orbB, tarOB, 0.08);

  spinAngle += 0.003;

  // kick flash — brief neon burst on each kick
  if (kickFlash > 0) {
    blendMode(SCREEN);
    noStroke();
    fill(floor(curR * kickFlash * 0.55), floor(curG * kickFlash * 0.55), floor(curB * kickFlash * 0.55));
    rect(-width / 2, -height / 2, width, height);
    blendMode(BLEND);
    kickFlash = lerp(kickFlash, 0, 0.25);
    if (kickFlash < 0.01) kickFlash = 0;
  }

  // visualizer
  vizLayer.clear();
  vizLayer.push();
  vizLayer.translate(width / 2, height / 2);
  vizLayer.push();
  vizLayer.rotate(spinAngle);

  const ringRadius = min(80 + bassEnv * 50 + transientEnv * 220, 260);

  for (let i = 0; i < 180; i++) {
    const angle = (i / 180) * TWO_PI - HALF_PI;
    const binIndex = 1 + floor(map(i, 0, 180, 0, 500));
    const value = pow(spectrum[binIndex] / 255, 0.55);
    const barH = value * (180 + transientEnv * 80); // bars also swell on kicks
    const x1 = cos(angle) * ringRadius;
    const y1 = sin(angle) * ringRadius;
    const x2 = cos(angle) * (ringRadius + barH);
    const y2 = sin(angle) * (ringRadius + barH);
    vizLayer.stroke(curR, curG, curB, (0.4 + value * 0.6) * 255);
    vizLayer.strokeWeight(2);
    vizLayer.drawingContext.shadowColor = `rgb(${floor(curR)},${floor(curG)},${floor(curB)})`;
    vizLayer.drawingContext.shadowBlur = value * 28; // more glow
    vizLayer.line(x1, y1, x2, y2);
  }

  vizLayer.noStroke();
  sparkles = sparkles.filter(s => s.life > 0);
  for (const s of sparkles) {
    s.x += s.vx;
    s.y += s.vy;
    s.life -= s.decay;
    vizLayer.drawingContext.shadowColor = `rgb(${floor(curR)},${floor(curG)},${floor(curB)})`;
    vizLayer.drawingContext.shadowBlur = 20;
    vizLayer.fill(curR, curG, curB, s.life * 255);
    vizLayer.circle(s.x, s.y, s.size * 2);
  }

  const orbRadius = 5 + melodyEnv * 26 + transientEnv * 50; // orb also reacts to kicks
  vizLayer.drawingContext.shadowColor = `rgb(${floor(orbR)},${floor(orbG)},${floor(orbB)})`;
  vizLayer.drawingContext.shadowBlur = 15 + melodyEnv * 60;
  vizLayer.fill(orbR, orbG, orbB);
  vizLayer.circle(0, 0, orbRadius * 2);

  vizLayer.pop();
  vizLayer.pop();

  drawingContext.shadowBlur = 0;

  // dreamy bloom: draw vizLayer ghost slightly scaled up first
  blendMode(SCREEN);
  tint(255, 55);
  push();
  scale(1.012);
  image(vizLayer, -width / 2, -height / 2);
  pop();
  noTint();
  blendMode(BLEND);

  // main visualizer
  image(vizLayer, -width / 2, -height / 2);

  if (trackName) {
    drawingContext.shadowColor = `rgb(${floor(curR)},${floor(curG)},${floor(curB)})`;
    drawingContext.shadowBlur = 8;
    noStroke();
    fill(255, 255, 255, 200);
    textAlign(CENTER, CENTER);
    textSize(13);
    text(trackName.toUpperCase(), 0, 360);
  }

  if (isRecording) {
    const remaining = ceil((RECORD_DURATION - (millis() - recordStart)) / 1000);
    drawingContext.shadowBlur = 0;
    noStroke();
    fill(255, 60, 60, 180 + sin(frameCount * 0.15) * 75);
    textAlign(LEFT, TOP);
    textSize(12);
    text(`● ${max(0, remaining)}s`, -width / 2 + 14, -height / 2 + 14);
  }

  if (countdown > 0) {
    if (millis() - countdownAt >= 1000) {
      countdown--;
      countdownAt = millis();
      if (countdown === 0) {
        flashAlpha = 255;
        saveCanvas('feelyourmusic', 'png');
      }
    }
    if (countdown > 0) {
      drawingContext.shadowColor = `rgb(${floor(curR)},${floor(curG)},${floor(curB)})`;
      drawingContext.shadowBlur = 30;
      noStroke();
      fill(255, 255, 255, 230);
      textAlign(CENTER, CENTER);
      textSize(120);
      text(countdown, 0, 0);
      drawingContext.shadowBlur = 0;
    }
  }

  if (flashAlpha > 0) {
    noStroke();
    fill(255, 255, 255, flashAlpha);
    rect(-width / 2, -height / 2, width, height);
    flashAlpha = max(0, flashAlpha - 18);
  }
}
