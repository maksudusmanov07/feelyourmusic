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

const themes = {
  neon:   [[57,255,20],  [255,16,240],  [15,240,252],  [255,255,0],   [255,102,0]],
  fire:   [[255,60,0],   [255,160,0],   [255,220,20],  [220,20,20],   [255,100,0]],
  ocean:  [[0,220,255],  [0,120,255],   [0,255,190],   [80,180,255],  [0,180,220]],
  purple: [[180,0,255],  [255,0,200],   [140,0,255],   [255,80,255],  [100,0,220]],
  mono:   [[255,255,255],[210,210,210], [240,240,240],  [180,180,180], [225,225,225]],
};

let neonColors = themes.neon;

function setup() {
  const cnv = createCanvas(800, 800);
  cnv.style('display', 'block');

  fft = new p5.FFT(0.75, 2048);
  vizLayer = createGraphics(800, 800);

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
    sound = loadSound(url, () => {
      sound.play();
      fft.setInput(sound);
    });
  });
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
  bassEnv = lerp(bassEnv, bass, bass > bassEnv ? 0.45 : 0.04);
  bassAvg = lerp(bassAvg, bassEnv, 0.003);

  const rawTransient = max(0, bassEnv - bassAvg);
  transientEnv = lerp(transientEnv, rawTransient, rawTransient > transientEnv ? 0.7 : 0.08);

  const mid = fft.getEnergy('mid') / 255;
  melodyEnv = lerp(melodyEnv, mid, mid > melodyEnv ? 0.3 : 0.05);

  const isKicking = transientEnv > 0.05;
  if (isKicking && !wasKicking) {
    colorIndex = (colorIndex + 1) % neonColors.length;
    kickFlash = 1.0;
    const spawnR = min(70 + bassEnv * 55 + transientEnv * 110, 190);
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

  // kick flash — alpha fades smoothly
  if (kickFlash > 0) {
    blendMode(SCREEN);
    noStroke();
    fill(curR, curG, curB, floor(kickFlash * 110));
    rect(-width / 2, -height / 2, width, height);
    blendMode(BLEND);
    kickFlash = lerp(kickFlash, 0, 0.22);
    if (kickFlash < 0.01) kickFlash = 0;
  }

  // feedback trail — fade existing pixels instead of clearing
  vizLayer.drawingContext.globalCompositeOperation = 'destination-out';
  vizLayer.drawingContext.fillStyle = 'rgba(255,255,255,0.12)';
  vizLayer.drawingContext.fillRect(0, 0, 800, 800);
  vizLayer.drawingContext.globalCompositeOperation = 'source-over';
  vizLayer.push();
  vizLayer.translate(width / 2, height / 2);
  vizLayer.push();
  vizLayer.rotate(spinAngle);

  const ringRadius = min(70 + bassEnv * 55 + transientEnv * 110, 190);

  for (let i = 0; i < 180; i++) {
    const angle = (i / 180) * TWO_PI - HALF_PI;
    const binIndex = 1 + floor(map(i, 0, 180, 0, 500));
    const value = pow(spectrum[binIndex] / 255, 0.65);
    const barH = value * (145 + transientEnv * 70);
    const x1 = cos(angle) * ringRadius;
    const y1 = sin(angle) * ringRadius;
    const x2 = cos(angle) * (ringRadius + barH);
    const y2 = sin(angle) * (ringRadius + barH);
    vizLayer.stroke(curR, curG, curB, (0.4 + value * 0.6) * 255);
    vizLayer.strokeWeight(2);
    vizLayer.drawingContext.shadowColor = `rgb(${floor(curR)},${floor(curG)},${floor(curB)})`;
    vizLayer.drawingContext.shadowBlur = value * 28;
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

  const orbRadius = 5 + melodyEnv * 26 + transientEnv * 50;
  vizLayer.drawingContext.shadowColor = `rgb(${floor(orbR)},${floor(orbG)},${floor(orbB)})`;
  vizLayer.drawingContext.shadowBlur = 15 + melodyEnv * 60;
  vizLayer.fill(orbR, orbG, orbB);
  vizLayer.circle(0, 0, orbRadius * 2);

  vizLayer.pop();
  vizLayer.pop();

  drawingContext.shadowBlur = 0;

  // chromatic aberration + bloom
  const aberPx = 2 + bassEnv * 6;
  blendMode(SCREEN);
  tint(255, 0, 0, 60);
  image(vizLayer, -width / 2 + aberPx, -height / 2);
  tint(0, 0, 255, 60);
  image(vizLayer, -width / 2 - aberPx, -height / 2);
  tint(255, 50);
  push(); scale(1.012); image(vizLayer, -width / 2, -height / 2); pop();
  noTint();
  blendMode(BLEND);

  image(vizLayer, -width / 2, -height / 2);

  // vignette
  const vig = drawingContext.createRadialGradient(0, 0, width * 0.28, 0, 0, width * 0.68);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.72)');
  drawingContext.fillStyle = vig;
  drawingContext.fillRect(-width / 2, -height / 2, width, height);

  // film grain
  drawingContext.fillStyle = 'rgba(255,255,255,0.06)';
  for (let i = 0; i < 350; i++) {
    drawingContext.fillRect(
      Math.random() * width - width / 2,
      Math.random() * height - height / 2,
      1, 1
    );
  }

  if (trackName) {
    drawingContext.shadowColor = `rgb(${floor(curR)},${floor(curG)},${floor(curB)})`;
    drawingContext.shadowBlur = 8;
    noStroke();
    fill(255, 255, 255, 200);
    textAlign(CENTER, CENTER);
    textSize(13);
    text(trackName.toUpperCase(), 0, 360);
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
