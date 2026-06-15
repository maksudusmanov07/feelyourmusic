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

// game
let gameNotes = [];
let score = 0;
let combo = 0;
let laneFlash = [0, 0, 0, 0];
let feedbackText = '';
let feedbackAlpha = 0;
let feedbackColor = [255, 255, 255];

const HIT_RADIUS = 290;
const NOTE_SPEED = 1.6;
const HIT_WINDOW = 24;

// 4 hit zones arced across the lower half, left to right = A S D F
const lanes = [
  { key: 'a', angle: (125 * PI) / 180 },
  { key: 's', angle: (105 * PI) / 180 },
  { key: 'd', angle: (75 * PI) / 180 },
  { key: 'f', angle: (55 * PI) / 180 },
];

const neonColors = [
  [57, 255, 20],
  [255, 16, 240],
  [15, 240, 252],
  [255, 255, 0],
  [255, 102, 0],
];

function setup() {
  const cnv = createCanvas(800, 800);
  cnv.style('display', 'block');
  fft = new p5.FFT(0.85, 2048);

  document.getElementById('fileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
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
  const k = key.toLowerCase();
  const laneIndex = lanes.findIndex(l => l.key === k);
  if (laneIndex === -1) return;

  laneFlash[laneIndex] = 255;

  let best = null;
  let bestDist = Infinity;
  for (const n of gameNotes) {
    if (n.lane === laneIndex && !n.hit && !n.missed) {
      const dist = abs(n.r - HIT_RADIUS);
      if (dist < HIT_WINDOW && dist < bestDist) {
        best = n;
        bestDist = dist;
      }
    }
  }

  if (best) {
    best.hit = true;
    combo++;
    score += 100 + combo * 10;
    feedbackText = bestDist < 10 ? 'PERFECT' : 'GOOD';
    feedbackColor = bestDist < 10 ? [255, 255, 0] : [100, 255, 100];
    feedbackAlpha = 255;
  } else {
    combo = 0;
    feedbackText = 'MISS';
    feedbackColor = [255, 60, 60];
    feedbackAlpha = 255;
  }
}

function draw() {
  background(11, 11, 13);
  translate(width / 2, height / 2);

  if (!sound || !sound.isPlaying()) return;

  const spectrum = fft.analyze();

  const bass = fft.getEnergy('bass') / 255;
  bassEnv = lerp(bassEnv, bass, bass > bassEnv ? 0.35 : 0.04);
  bassAvg = lerp(bassAvg, bassEnv, 0.003);

  const rawTransient = max(0, bassEnv - bassAvg);
  transientEnv = lerp(transientEnv, rawTransient, rawTransient > transientEnv ? 0.5 : 0.09);

  const mid = fft.getEnergy('mid') / 255;
  melodyEnv = lerp(melodyEnv, mid, mid > melodyEnv ? 0.3 : 0.05);

  const isKicking = transientEnv > 0.06;
  if (isKicking && !wasKicking) {
    colorIndex = (colorIndex + 1) % neonColors.length;

    // spawn note in random lane
    const spawnR = min(80 + bassEnv * 40 + transientEnv * 180, 175);
    gameNotes.push({ lane: floor(random(4)), r: spawnR, hit: false, missed: false });

    // sparkles from bar tips
    for (let i = 0; i < 14; i++) {
      const a = random(TWO_PI);
      const spawnRadius = spawnR + random(30, 100);
      sparkles.push({
        x: cos(a) * spawnRadius,
        y: sin(a) * spawnRadius,
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

  // --- rotated visualizer ---
  push();
  rotate(spinAngle);

  const ringRadius = min(80 + bassEnv * 40 + transientEnv * 180, 175);

  for (let i = 0; i < 180; i++) {
    const angle = (i / 180) * TWO_PI - HALF_PI;
    const binIndex = 1 + floor(map(i, 0, 180, 0, 500));
    const value = pow(spectrum[binIndex] / 255, 0.55);
    const barH = value * 180;

    const x1 = cos(angle) * ringRadius;
    const y1 = sin(angle) * ringRadius;
    const x2 = cos(angle) * (ringRadius + barH);
    const y2 = sin(angle) * (ringRadius + barH);

    stroke(curR, curG, curB, (0.4 + value * 0.6) * 255);
    strokeWeight(2);
    drawingContext.shadowColor = `rgb(${floor(curR)},${floor(curG)},${floor(curB)})`;
    drawingContext.shadowBlur = value * 18;
    line(x1, y1, x2, y2);
  }

  noStroke();
  sparkles = sparkles.filter(s => s.life > 0);
  for (const s of sparkles) {
    s.x += s.vx;
    s.y += s.vy;
    s.life -= s.decay;
    drawingContext.shadowColor = `rgb(${floor(curR)},${floor(curG)},${floor(curB)})`;
    drawingContext.shadowBlur = 14;
    fill(curR, curG, curB, s.life * 255);
    circle(s.x, s.y, s.size * 2);
  }

  const orbRadius = 5 + melodyEnv * 26 + transientEnv * 30;
  drawingContext.shadowColor = `rgb(${floor(orbR)},${floor(orbG)},${floor(orbB)})`;
  drawingContext.shadowBlur = 10 + melodyEnv * 40;
  fill(orbR, orbG, orbB);
  circle(0, 0, orbRadius * 2);

  pop();

  // --- game layer (non-rotating) ---
  drawingContext.shadowBlur = 0;

  // move notes + detect misses
  for (const n of gameNotes) {
    n.r += NOTE_SPEED;
    if (!n.hit && !n.missed && n.r > HIT_RADIUS + HIT_WINDOW) {
      n.missed = true;
      combo = 0;
      feedbackText = 'MISS';
      feedbackColor = [255, 60, 60];
      feedbackAlpha = 255;
    }
  }
  gameNotes = gameNotes.filter(n => n.r < HIT_RADIUS + 50);

  // draw notes
  noStroke();
  for (const n of gameNotes) {
    if (n.missed) continue;
    const laneAngle = lanes[n.lane].angle;
    const nx = cos(laneAngle) * n.r;
    const ny = sin(laneAngle) * n.r;
    const noteAlpha = n.hit ? max(0, (1 - (n.r - HIT_RADIUS) / 40) * 255) : 255;
    drawingContext.shadowColor = `rgb(${floor(curR)},${floor(curG)},${floor(curB)})`;
    drawingContext.shadowBlur = 16;
    fill(curR, curG, curB, noteAlpha);
    circle(nx, ny, 22);
  }

  // draw hit zones
  laneFlash = laneFlash.map(f => max(0, f - 9));
  for (let i = 0; i < lanes.length; i++) {
    const lane = lanes[i];
    const hx = cos(lane.angle) * HIT_RADIUS;
    const hy = sin(lane.angle) * HIT_RADIUS;

    drawingContext.shadowColor = `rgb(${floor(curR)},${floor(curG)},${floor(curB)})`;
    drawingContext.shadowBlur = 6 + laneFlash[i] * 0.08;
    stroke(curR, curG, curB, 90 + laneFlash[i] * 0.65);
    strokeWeight(2);
    noFill();
    circle(hx, hy, 34);

    drawingContext.shadowBlur = 0;
    noStroke();
    fill(255, 255, 255, 130);
    textAlign(CENTER, CENTER);
    textSize(11);
    text(lane.key.toUpperCase(), cos(lane.angle) * (HIT_RADIUS + 26), sin(lane.angle) * (HIT_RADIUS + 26));
  }

  // score + combo
  drawingContext.shadowBlur = 0;
  noStroke();
  fill(255, 255, 255, 160);
  textAlign(LEFT, TOP);
  textSize(13);
  text(`score  ${score}`, -385, -390);
  text(`combo  x${combo}`, -385, -370);

  // feedback
  if (feedbackAlpha > 0) {
    drawingContext.shadowBlur = 0;
    fill(feedbackColor[0], feedbackColor[1], feedbackColor[2], feedbackAlpha);
    textAlign(CENTER, CENTER);
    textSize(20);
    text(feedbackText, 0, -215);
    feedbackAlpha = max(0, feedbackAlpha - 7);
  }
}
