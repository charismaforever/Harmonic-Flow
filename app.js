/* ═══════════════════════════════════════════════
   HARMONICFLOW — app.js
   ═══════════════════════════════════════════════ */

// ────────────────────────────────────────────────
// MUSIC DATA
// ────────────────────────────────────────────────
const NOTES        = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const DISPLAY      = ['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
const FLAT_DISPLAY = ['C','D♭','D','E♭','E','F','G♭','G','A♭','A','B♭','B'];
const CIRCLE_5TH   = ['C','G','D','A','E','B','F#','Db','Ab','Eb','Bb','F'];
const CIRCLE_MIN   = ['Am','Em','Bm','F#m','C#m','G#m','D#m','Bbm','Fm','Cm','Gm','Dm'];
const KEY_SIGS     = {'C':'0♯','G':'1♯','D':'2♯','A':'3♯','E':'4♯','B':'5♯','F#':'6♯','Db':'5♭','Ab':'4♭','Eb':'3♭','Bb':'2♭','F':'1♭'};

const FREQS_C4 = {
  C:261.63,  'C#':277.18, D:293.66, 'D#':311.13, E:329.63,
  F:349.23,  'F#':369.99, G:392.00, 'G#':415.30, A:440.00,
  'A#':466.16, B:493.88
};

const CHORD_TYPES = {
  'Major':[0,4,7], 'Minor':[0,3,7], 'Dom7':[0,4,7,10],
  'Maj7':[0,4,7,11], 'Min7':[0,3,7,10], 'Dim':[0,3,6],
  'Aug':[0,4,8], 'Sus4':[0,5,7], 'Sus2':[0,2,7], 'Add9':[0,4,7,14]
};

const SCALE_TYPES = {
  'Major':     { intervals:[0,2,4,5,7,9,11], steps:'W W H W W W H' },
  'Nat. Minor':{ intervals:[0,2,3,5,7,8,10], steps:'W H W W H W W' },
  'Dorian':    { intervals:[0,2,3,5,7,9,10], steps:'W H W W W H W' },
  'Mixolydian':{ intervals:[0,2,4,5,7,9,10], steps:'W W H W W H W' },
  'Lydian':    { intervals:[0,2,4,6,7,9,11], steps:'W W W H W W H' },
  'Phrygian':  { intervals:[0,1,3,5,7,8,10], steps:'H W W W H W W' },
  'Blues':     { intervals:[0,3,5,6,7,10],   steps:'m3 W H H m3 W' },
  'Pentatonic':{ intervals:[0,2,4,7,9],       steps:'W W m3 W m3' },
};

const SPECTRUM_REGIONS = [
  {lo:20,   hi:60,    name:'Sub Bass',  color:'#fb7185'},
  {lo:60,   hi:250,   name:'Bass',      color:'#f59e0b'},
  {lo:250,  hi:500,   name:'Low Mid',   color:'#34d399'},
  {lo:500,  hi:2000,  name:'Mid',       color:'#2dd4bf'},
  {lo:2000, hi:6000,  name:'High Mid',  color:'#67e8f9'},
  {lo:6000, hi:20000, name:'High',      color:'#a78bfa'},
];

function getRegion(f) {
  return SPECTRUM_REGIONS.find(r => f >= r.lo && f < r.hi) || SPECTRUM_REGIONS[3];
}

function getNoteFreq(noteStr, oct=4) {
  const clean = noteStr.replace('♯','#').replace('♭','b');
  const map = {'Db':'C#','Eb':'D#','Gb':'F#','Ab':'G#','Bb':'A#'};
  const n = map[clean] || clean;
  const base = FREQS_C4[n];
  if (!base) return 440;
  return base * Math.pow(2, oct - 4);
}

function freqToNote(freq) {
  const semis = Math.round(12 * Math.log2(freq / 440)) + 9; // A4=9
  return NOTES[((semis % 12) + 12) % 12];
}

function getMidi(note, oct=4) {
  const idx = NOTES.indexOf(note.replace('♯','#').replace('♭','b'));
  return idx >= 0 ? (oct + 1) * 12 + idx : null;
}

function getMajorScale(noteStr) {
  const n = noteStr.replace('♯','#').replace('♭','b');
  const map = {'Db':'C#','Eb':'D#','Gb':'F#','Ab':'G#','Bb':'A#'};
  const clean = map[n] || n;
  const start = NOTES.indexOf(clean);
  if (start < 0) return '';
  return [0,2,4,5,7,9,11].map(i => DISPLAY[(start+i)%12]).join(' · ');
}

// ────────────────────────────────────────────────
// AUDIO ENGINE
// ────────────────────────────────────────────────
let audioCtx = null, analyser = null, masterGain = null, reverbGain = null, reverbNode = null;
const held = {};
let waveType = 'sine';
let octave   = 4;

function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  analyser  = audioCtx.createAnalyser();
  analyser.fftSize = 2048;
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.45;
  masterGain.connect(analyser);
  analyser.connect(audioCtx.destination);

  // Simple convolver reverb
  reverbGain = audioCtx.createGain();
  reverbGain.gain.value = 0.2;
  reverbGain.connect(audioCtx.destination);
  createReverb();

  startVizLoop();
}

function createReverb() {
  if (reverbNode) return;
  const sr = audioCtx.sampleRate;
  const buf = audioCtx.createBuffer(2, sr * 2.5, sr);
  for (let ch=0; ch<2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i=0; i<d.length; i++) d[i] = (Math.random()*2-1) * Math.pow(1-i/d.length,2);
  }
  reverbNode = audioCtx.createConvolver();
  reverbNode.buffer = buf;
  reverbNode.connect(reverbGain);
}

function playTone(freq, duration=1.5) {
  initAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const env = audioCtx.createGain();
  osc.type = waveType;
  osc.frequency.value = freq;
  const atk = parseFloat(document.getElementById('attackSlider')?.value || 0.02);
  const rel = parseFloat(document.getElementById('releaseSlider')?.value || 0.8);
  env.gain.setValueAtTime(0, audioCtx.currentTime);
  env.gain.linearRampToValueAtTime(0.55, audioCtx.currentTime + atk);
  env.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration + rel);
  osc.connect(env);
  env.connect(masterGain);
  if (reverbNode) env.connect(reverbNode);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + duration + rel + 0.1);
  updateFreqUI(freq);
}

function holdNote(id, freq) {
  if (held[id]) return;
  initAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const osc = audioCtx.createOscillator();
  const env = audioCtx.createGain();
  osc.type = waveType;
  osc.frequency.value = freq;
  const atk = parseFloat(document.getElementById('attackSlider')?.value || 0.02);
  env.gain.setValueAtTime(0, audioCtx.currentTime);
  env.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + atk);
  osc.connect(env);
  env.connect(masterGain);
  if (reverbNode) env.connect(reverbNode);
  osc.start();
  held[id] = {osc, env};
  updateFreqUI(freq);
}

function releaseNote(id) {
  if (!held[id]) return;
  const {osc, env} = held[id];
  const rel = parseFloat(document.getElementById('releaseSlider')?.value || 0.8);
  env.gain.setValueAtTime(env.gain.value, audioCtx.currentTime);
  env.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + rel);
  osc.stop(audioCtx.currentTime + rel + 0.05);
  delete held[id];
}

function setReverb(v) { if (reverbGain) reverbGain.gain.value = parseFloat(v); }
function setWave(w, btn) {
  waveType = w;
  document.querySelectorAll('.wave-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}
function changeOctave(d) {
  octave = Math.max(1, Math.min(7, octave + d));
  document.getElementById('octaveVal').textContent = octave;
  buildKeyboard();
}

// ────────────────────────────────────────────────
// FREQUENCY UI
// ────────────────────────────────────────────────
function updateFreqUI(freq) {
  document.getElementById('freqVal').textContent  = freq.toFixed(2);
  document.getElementById('freqNote').textContent = freqToNote(freq);
  const reg = getRegion(freq);
  document.getElementById('freqRange').textContent = reg.name;
  document.getElementById('freqRange').style.color = reg.color;
  // log bar
  const pct = (Math.log(freq/20) / Math.log(20000/20)) * 100;
  const bar = document.getElementById('freqMeterBar');
  if (bar) bar.style.setProperty('--w', Math.max(2, Math.min(100, pct)) + '%');
  // Direct width on ::after via a CSS var trick
  if (bar) bar.style.cssText = `--dummy:0`; // force repaint
  const style = bar?.style;
  if (bar) bar.setAttribute('data-pct', Math.max(2, Math.min(100, pct)));
  updateFreqBar(pct);
}
function updateFreqBar(pct) {
  const bar = document.getElementById('freqMeterBar');
  if (!bar) return;
  bar.style.background = `linear-gradient(90deg, #0d9488 0%, #2dd4bf ${pct*0.6}%, #f59e0b ${pct}%, rgba(45,212,191,0.1) ${pct}%)`;
  bar.style.backgroundSize = '100% 100%';
}

// ────────────────────────────────────────────────
// VISUALIZER LOOP
// ────────────────────────────────────────────────
function startVizLoop() {
  const sc = document.getElementById('specCanvas');
  const wc = document.getElementById('waveCanvas');
  if (!sc || !wc) return;
  const sCtx = sc.getContext('2d');
  const wCtx = wc.getContext('2d');
  const bufLen = analyser.frequencyBinCount;
  const freqData = new Uint8Array(bufLen);
  const timeData = new Uint8Array(bufLen);

  function draw() {
    requestAnimationFrame(draw);
    const SW = sc.offsetWidth || 500, SH = 100;
    const WW = wc.offsetWidth || 500, WH = 100;
    sc.width = SW; wc.width = WW;

    analyser.getByteFrequencyData(freqData);
    analyser.getByteTimeDomainData(timeData);

    // — Spectrum —
    sCtx.fillStyle = 'rgba(6,14,26,0.85)';
    sCtx.fillRect(0,0,SW,SH);
    const bars = 96, bw = SW / bars;
    for (let i=0; i<bars; i++) {
      const v = freqData[i] / 255;
      const h = v * SH * 0.9;
      const hue = 175 + i * 0.7;
      sCtx.fillStyle = `hsla(${hue},80%,${50+v*15}%,${0.5+v*0.5})`;
      sCtx.fillRect(i * bw, SH - h, bw - 1, h);
      // mirror reflection
      sCtx.fillStyle = `hsla(${hue},80%,${40+v*15}%,${v*0.18})`;
      sCtx.fillRect(i * bw, SH, bw - 1, h * 0.25);
    }

    // — Waveform —
    wCtx.fillStyle = 'rgba(6,14,26,0.85)';
    wCtx.fillRect(0,0,WW,WH);
    wCtx.beginPath();
    const slice = WW / bufLen;
    let x = 0;
    for (let i=0; i<bufLen; i++) {
      const y = ((timeData[i]/128) - 1) * (WH/2.4) + WH/2;
      i === 0 ? wCtx.moveTo(x,y) : wCtx.lineTo(x,y);
      x += slice;
    }
    const wg = wCtx.createLinearGradient(0,0,WW,0);
    wg.addColorStop(0,   '#2dd4bf');
    wg.addColorStop(0.5, '#a78bfa');
    wg.addColorStop(1,   '#fb7185');
    wCtx.strokeStyle = wg;
    wCtx.lineWidth = 1.8;
    wCtx.stroke();
  }
  draw();
}

// ────────────────────────────────────────────────
// BACKGROUND PARTICLES
// ────────────────────────────────────────────────
(function bgParticles() {
  const canvas = document.getElementById('bgCanvas');
  const ctx    = canvas.getContext('2d');
  let W, H, particles = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  for (let i=0; i<55; i++) {
    particles.push({
      x: Math.random()*1000, y: Math.random()*1000,
      r: Math.random()*1.5 + 0.3,
      vx: (Math.random()-0.5)*0.18, vy: (Math.random()-0.5)*0.18,
      opacity: Math.random()*0.4 + 0.05,
      hue: Math.random() > 0.7 ? 280 : 175,
    });
  }

  function draw() {
    ctx.clearRect(0,0,W,H);
    particles.forEach(p => {
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
      ctx.fillStyle = `hsla(${p.hue},80%,70%,${p.opacity})`;
      ctx.fill();
    });
    // connection lines
    for (let i=0; i<particles.length; i++) {
      for (let j=i+1; j<particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const d  = Math.sqrt(dx*dx+dy*dy);
        if (d < 100) {
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(45,212,191,${0.06*(1-d/100)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(draw);
  }
  draw();
})();

// ────────────────────────────────────────────────
// HERO CIRCLE (animated)
// ────────────────────────────────────────────────
(function heroCircleAnim() {
  const canvas = document.getElementById('heroCircle');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let t = 0;

  function draw() {
    const W=420, H=420, cx=W/2, cy=H/2;
    ctx.clearRect(0,0,W,H);

    // Radial rings
    [160,120,80,40].forEach((r,i) => {
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
      ctx.strokeStyle = `rgba(45,212,191,${0.04+i*0.04})`;
      ctx.lineWidth = 1; ctx.stroke();
    });

    // Rotating outer ring with note dots
    CIRCLE_5TH.forEach((note,i) => {
      const angle = (i/12)*Math.PI*2 - Math.PI/2 + t*0.003;
      const rx = cx + Math.cos(angle)*155, ry = cy + Math.sin(angle)*155;
      ctx.beginPath(); ctx.arc(rx,ry,18,0,Math.PI*2);
      const grad = ctx.createRadialGradient(rx,ry,0,rx,ry,18);
      grad.addColorStop(0,'rgba(45,212,191,0.25)');
      grad.addColorStop(1,'rgba(13,148,136,0.05)');
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(45,212,191,0.35)'; ctx.lineWidth=1; ctx.stroke();
      ctx.font='bold 11px Orbitron,monospace';
      ctx.fillStyle='#dff0f8';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(note,rx,ry);
    });

    // Inner Coltrane triangle
    const triNotes = ['B','G','E♭'];
    const triPts = triNotes.map((_,i) => ({
      x: cx + Math.cos(-Math.PI/2 + (i/3)*Math.PI*2 + t*0.008)*88,
      y: cy + Math.sin(-Math.PI/2 + (i/3)*Math.PI*2 + t*0.008)*88,
    }));

    ctx.beginPath();
    ctx.moveTo(triPts[0].x,triPts[0].y);
    triPts.forEach(p => ctx.lineTo(p.x,p.y));
    ctx.closePath();
    ctx.strokeStyle = 'rgba(167,139,250,0.45)'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.fillStyle   = 'rgba(167,139,250,0.04)'; ctx.fill();

    triPts.forEach((p,i) => {
      ctx.beginPath(); ctx.arc(p.x,p.y,16,0,Math.PI*2);
      ctx.fillStyle='rgba(167,139,250,0.18)'; ctx.fill();
      ctx.strokeStyle='rgba(167,139,250,0.6)'; ctx.lineWidth=1.5; ctx.stroke();
      ctx.font='bold 11px Orbitron,monospace';
      ctx.fillStyle='#a78bfa'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(triNotes[i],p.x,p.y);
    });

    // Center pulse
    const pulse = 1 + Math.sin(t*0.05)*0.12;
    ctx.beginPath(); ctx.arc(cx,cy,24*pulse,0,Math.PI*2);
    ctx.fillStyle='rgba(45,212,191,0.12)'; ctx.fill();
    ctx.strokeStyle='rgba(45,212,191,0.6)'; ctx.lineWidth=1.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(cx,cy,8,0,Math.PI*2);
    ctx.fillStyle='#2dd4bf'; ctx.fill();

    t++;
    requestAnimationFrame(draw);
  }
  draw();
})();

// ────────────────────────────────────────────────
// CIRCLE OF FIFTHS (interactive)
// ────────────────────────────────────────────────
let showMinorKeys = false, showChordHighlight = false;
let activeCircleNote = null;

function toggleMinorKeys() {
  showMinorKeys = !showMinorKeys;
  const btn = document.getElementById('minorToggle');
  btn.classList.toggle('active', showMinorKeys);
  drawCircle();
}
function toggleChordHighlight() {
  showChordHighlight = !showChordHighlight;
  const btn = document.getElementById('chordToggle');
  btn.classList.toggle('active', showChordHighlight);
  drawCircle();
}

function drawCircle() {
  const canvas = document.getElementById('circleCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W=380, H=380, cx=W/2, cy=H/2;
  const R_OUT=170, R_MID=118, R_IN=78;
  ctx.clearRect(0,0,W,H);

  // Background rings
  [R_OUT+10, R_MID+10, R_IN+10].forEach(r => {
    ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
    ctx.strokeStyle='rgba(45,212,191,0.05)'; ctx.lineWidth=1; ctx.stroke();
  });

  // Chord highlight: if active note, highlight related keys
  let highlighted = new Set();
  if (showChordHighlight && activeCircleNote) {
    const idx = CIRCLE_5TH.indexOf(activeCircleNote);
    if (idx>=0) {
      highlighted.add(CIRCLE_5TH[(idx+12)%12]);
      highlighted.add(CIRCLE_5TH[(idx+1)%12]);
      highlighted.add(CIRCLE_5TH[(idx-1+12)%12]);
    }
  }

  CIRCLE_5TH.forEach((note,i) => {
    const start = (i/12)*Math.PI*2 - Math.PI/2 - Math.PI/12;
    const end   = start + Math.PI/6;
    const isAct = activeCircleNote === note;
    const isHi  = highlighted.has(note);

    // Sector
    ctx.beginPath();
    ctx.moveTo(cx,cy); ctx.arc(cx,cy,R_OUT,start,end); ctx.closePath();
    if (isAct) {
      const g = ctx.createRadialGradient(cx,cy,R_MID,cx,cy,R_OUT);
      g.addColorStop(0,'rgba(45,212,191,0.25)'); g.addColorStop(1,'rgba(45,212,191,0.5)');
      ctx.fillStyle = g;
    } else if (isHi) {
      ctx.fillStyle = 'rgba(167,139,250,0.15)';
    } else {
      ctx.fillStyle = 'rgba(15,30,53,0.85)';
    }
    ctx.fill();
    ctx.strokeStyle = isAct ? 'rgba(45,212,191,0.8)' : isHi ? 'rgba(167,139,250,0.5)' : 'rgba(45,212,191,0.1)';
    ctx.lineWidth = isAct ? 1.8 : 0.8; ctx.stroke();

    // Note label
    const mid = start + Math.PI/12;
    const lx  = cx + Math.cos(mid)*(R_MID+25), ly = cy + Math.sin(mid)*(R_MID+25);
    ctx.font  = `${isAct?'bold 15px':'13px'} Orbitron,monospace`;
    ctx.fillStyle = isAct ? '#2dd4bf' : '#dff0f8';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(note, lx, ly);

    // Minor ring
    if (showMinorKeys) {
      const mx = cx + Math.cos(mid)*(R_IN+12), my = cy + Math.sin(mid)*(R_IN+12);
      // Inner sector
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,R_IN,start,end); ctx.closePath();
      ctx.fillStyle='rgba(45,212,191,0.04)'; ctx.fill();
      ctx.font='9px DM Mono,monospace'; ctx.fillStyle='rgba(103,232,249,0.75)';
      ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText(CIRCLE_MIN[i], mx, my);
    }
  });

  // Inner circle
  ctx.beginPath(); ctx.arc(cx,cy,R_IN,0,Math.PI*2);
  ctx.fillStyle='rgba(6,14,26,0.9)'; ctx.fill();
  ctx.strokeStyle='rgba(45,212,191,0.2)'; ctx.lineWidth=1.5; ctx.stroke();

  // Center text
  ctx.font='10px DM Mono,monospace'; ctx.fillStyle='rgba(110,154,181,0.6)';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('Circle of', cx, cy-10);
  ctx.font='bold 14px Orbitron,monospace'; ctx.fillStyle='#2dd4bf';
  ctx.fillText('Fifths', cx, cy+8);
}

document.getElementById('circleCanvas')?.addEventListener('click', e => {
  const rect = e.target.getBoundingClientRect();
  const sx = e.target.width/rect.width, sy = e.target.height/rect.height;
  const mx = (e.clientX-rect.left)*sx, my = (e.clientY-rect.top)*sy;
  const cx=190, cy=190;
  const dx=mx-cx, dy=my-cy;
  const dist = Math.sqrt(dx*dx+dy*dy);
  if (dist < 82 || dist > 178) return;
  let angle = Math.atan2(dy,dx) + Math.PI/2;
  if (angle<0) angle += Math.PI*2;
  const idx = Math.round(angle/(Math.PI*2/12)) % 12;
  const note = CIRCLE_5TH[idx];
  activeCircleNote = note;
  drawCircle();
  const freq = getNoteFreq(note, 4);
  playTone(freq, 1.6);
  showNotePanel(note, freq, 'circleNoteDisplay');
});

function showNotePanel(noteStr, freq, panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  const reg = getRegion(freq);
  const midi = getMidi(noteStr.replace('#','#'), 4);
  const scale = getMajorScale(noteStr);
  const keySig = KEY_SIGS[noteStr] || '—';
  panel.innerHTML = `
    <div class="nd-note">${noteStr}</div>
    <div class="nd-grid">
      <div class="nd-item"><label>Frequency</label><value>${freq.toFixed(2)} Hz</value></div>
      <div class="nd-item"><label>MIDI</label><value>${midi ?? '—'}</value></div>
      <div class="nd-item"><label>Key Sig</label><value>${keySig}</value></div>
      <div class="nd-item"><label>Spectrum</label><value style="color:${reg.color}">${reg.name}</value></div>
      <div class="nd-item"><label>Enharmonic</label><value>${getEnharmonic(noteStr)}</value></div>
      <div class="nd-item"><label>Octave</label><value>4 (Middle)</value></div>
    </div>
    <div class="nd-scale">${scale}</div>
  `;
}

function getEnharmonic(n) {
  const map={'C#':'D♭','D#':'E♭','F#':'G♭','G#':'A♭','A#':'B♭','Db':'C♯','Eb':'D♯','Gb':'F♯','Ab':'G♯','Bb':'A♯'};
  return map[n] || '—';
}

// ────────────────────────────────────────────────
// COLTRANE MATRIX
// ────────────────────────────────────────────────
let coltraneRot = 0, coltraneExpanded = false;
let activeColtraneNote = null;

const COL_COLORS = ['#2dd4bf','#a78bfa','#fb7185'];
const COL_NOTES_ALL = [
  // Full 12-note Coltrane cycle: groups of major thirds
  ['B','G','E♭'], ['D','B♭','G♭'], ['F#','D','B♭'],
];
const COL_MAIN = ['B','G','E♭'];

function rotateColtrane(dir) {
  coltraneRot += dir * (Math.PI/6);
  drawColtrane();
}
function expandColtrane() {
  coltraneExpanded = !coltraneExpanded;
  drawColtrane();
}

function drawColtrane() {
  const canvas = document.getElementById('coltraneCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W=380, H=380, cx=W/2, cy=H/2;
  ctx.clearRect(0,0,W,H);

  const R = coltraneExpanded ? 120 : 100;
  const notes = coltraneExpanded
    ? ['B','G','E♭','D','B♭','F♯','A♭','E','C']
    : COL_MAIN;
  const N = notes.length;
  const pts = notes.map((_,i) => ({
    x: cx + Math.cos(-Math.PI/2 + (i/N)*Math.PI*2 + coltraneRot) * R,
    y: cy + Math.sin(-Math.PI/2 + (i/N)*Math.PI*2 + coltraneRot) * R,
    note: notes[i],
  }));

  // Background geometry
  ctx.beginPath();
  pts.forEach((p,i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
  ctx.closePath();
  const bg = ctx.createRadialGradient(cx,cy,0,cx,cy,R);
  bg.addColorStop(0,'rgba(167,139,250,0.06)');
  bg.addColorStop(1,'rgba(45,212,191,0.04)');
  ctx.fillStyle=bg; ctx.fill();

  // Connecting lines
  pts.forEach((p,i) => {
    const next = pts[(i+1)%N];
    ctx.beginPath(); ctx.moveTo(p.x,p.y); ctx.lineTo(next.x,next.y);
    ctx.strokeStyle = COL_COLORS[i%3];
    ctx.globalAlpha = 0.35; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.globalAlpha = 1;

    // Mid arrow
    const mx=(p.x+next.x)/2, my=(p.y+next.y)/2;
    const ang=Math.atan2(next.y-p.y,next.x-p.x);
    ctx.beginPath();
    ctx.moveTo(mx+Math.cos(ang)*7, my+Math.sin(ang)*7);
    ctx.lineTo(mx+Math.cos(ang+2.6)*5, my+Math.sin(ang+2.6)*5);
    ctx.lineTo(mx+Math.cos(ang-2.6)*5, my+Math.sin(ang-2.6)*5);
    ctx.closePath(); ctx.fillStyle=COL_COLORS[i%3]; ctx.globalAlpha=0.5; ctx.fill(); ctx.globalAlpha=1;

    // Interval label
    ctx.font='9px DM Mono,monospace'; ctx.fillStyle='rgba(110,154,181,0.6)';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText('M3', mx+Math.cos(ang+Math.PI/2)*13, my+Math.sin(ang+Math.PI/2)*13);
  });

  // Node circles
  pts.forEach((p,i) => {
    const isAct = activeColtraneNote === p.note;
    const r = isAct ? 26 : 22;
    const col = COL_COLORS[i%3];

    // Outer glow
    if (isAct) {
      ctx.beginPath(); ctx.arc(p.x,p.y,r+14,0,Math.PI*2);
      ctx.fillStyle=col.replace(')',',0.12)').replace('rgb','rgba').replace('#', 'rgba(').replace('2dd4bf','45,212,191,0.12)').replace('a78bfa','167,139,250,0.12)').replace('fb7185','251,113,133,0.12)');
      // Simpler:
      ctx.fillStyle = isAct ? 'rgba(45,212,191,0.1)' : 'transparent'; ctx.fill();
    }

    // Circle fill
    ctx.beginPath(); ctx.arc(p.x,p.y,r,0,Math.PI*2);
    const g = ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,r);
    g.addColorStop(0, isAct ? col : 'rgba(15,30,53,0.9)');
    g.addColorStop(1, 'rgba(6,14,26,0.95)');
    ctx.fillStyle=g; ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = isAct ? 2.5 : 1.5;
    ctx.globalAlpha = isAct ? 1 : 0.55; ctx.stroke(); ctx.globalAlpha=1;

    // Label
    ctx.font=`${isAct?'bold 14px':'12px'} Orbitron,monospace`;
    ctx.fillStyle = isAct ? col : '#dff0f8';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(p.note, p.x, p.y);
  });

  // Center label
  ctx.font='9px DM Mono,monospace'; ctx.fillStyle='rgba(110,154,181,0.35)';
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText('Giant Steps', cx, cy-7);
  ctx.fillText('Matrix', cx, cy+7);
}

document.getElementById('coltraneCanvas')?.addEventListener('click', e => {
  const rect = e.target.getBoundingClientRect();
  const sx=e.target.width/rect.width, sy=e.target.height/rect.height;
  const mx=(e.clientX-rect.left)*sx, my=(e.clientY-rect.top)*sy;
  const cx=190,cy=190,R=100;
  const notes = coltraneExpanded ? ['B','G','E♭','D','B♭','F♯','A♭','E','C'] : COL_MAIN;
  const N=notes.length;
  for(let i=0;i<N;i++){
    const px=cx+Math.cos(-Math.PI/2+(i/N)*Math.PI*2+coltraneRot)*R;
    const py=cy+Math.sin(-Math.PI/2+(i/N)*Math.PI*2+coltraneRot)*R;
    if(Math.sqrt((mx-px)**2+(my-py)**2)<28){
      activeColtraneNote=notes[i];
      drawColtrane();
      const noteClean = notes[i].replace('♭','b').replace('♯','#');
      const freq=getNoteFreq(noteClean, 4);
      playTone(freq, 2);
      showNotePanel(notes[i], freq, 'coltraneNoteDisplay');
      return;
    }
  }
});

// ────────────────────────────────────────────────
// KEYBOARD
// ────────────────────────────────────────────────
const WHITE = ['C','D','E','F','G','A','B'];
const BLACK_AFTER = {'C':'C#','D':'D#','F':'F#','G':'G#','A':'A#'};

function buildKeyboard() {
  const kb = document.getElementById('keyboard');
  if (!kb) return;
  kb.innerHTML = '';
  const numOct = 2;
  for (let o=octave; o<octave+numOct; o++) {
    WHITE.forEach(n => {
      const key = document.createElement('div');
      key.className='key white';
      key.textContent=(n==='C'||o===octave&&n==='C') ? n+o : n;
      key.dataset.note=n; key.dataset.oct=o;
      const id=`${n}${o}`;
      key.addEventListener('mousedown', ()=>{ holdNote(id, getNoteFreq(n,o)); key.classList.add('pressing'); showActiveNote(n,o); });
      key.addEventListener('mouseup', ()=>{ releaseNote(id); key.classList.remove('pressing'); });
      key.addEventListener('mouseleave', ()=>{ releaseNote(id); key.classList.remove('pressing'); });
      key.addEventListener('touchstart', ev=>{ev.preventDefault(); holdNote(id,getNoteFreq(n,o)); key.classList.add('pressing'); showActiveNote(n,o);});
      key.addEventListener('touchend', ev=>{ev.preventDefault(); releaseNote(id); key.classList.remove('pressing');});
      kb.appendChild(key);

      if (BLACK_AFTER[n]) {
        const bn=BLACK_AFTER[n];
        const bkey=document.createElement('div');
        bkey.className='key black';
        bkey.textContent=bn.replace('#','♯');
        bkey.dataset.note=bn; bkey.dataset.oct=o;
        const bid=`${bn}${o}`;
        bkey.addEventListener('mousedown', ()=>{ holdNote(bid,getNoteFreq(bn,o)); bkey.classList.add('pressing'); showActiveNote(bn,o); });
        bkey.addEventListener('mouseup', ()=>{ releaseNote(bid); bkey.classList.remove('pressing'); });
        bkey.addEventListener('mouseleave', ()=>{ releaseNote(bid); bkey.classList.remove('pressing'); });
        bkey.addEventListener('touchstart', ev=>{ev.preventDefault(); holdNote(bid,getNoteFreq(bn,o)); bkey.classList.add('pressing'); showActiveNote(bn,o);});
        bkey.addEventListener('touchend', ev=>{ev.preventDefault(); releaseNote(bid); bkey.classList.remove('pressing');});
        kb.appendChild(bkey);
      }
    });
  }
}

function showActiveNote(note, oct) {
  const freq=getNoteFreq(note,oct);
  const reg=getRegion(freq);
  document.getElementById('andNote').textContent=note.replace('#','♯');
  document.getElementById('andFreq').textContent=freq.toFixed(2)+' Hz';
  document.getElementById('andMidi').textContent='MIDI '+getMidi(note,oct);
  document.getElementById('andRange').textContent=reg.name;
  document.getElementById('andRange').style.color=reg.color;
  updateFreqUI(freq);
}

// Computer keyboard
const KB_MAP={'a':'C','w':'C#','s':'D','e':'D#','d':'E','f':'F','t':'F#','g':'G','y':'G#','h':'A','u':'A#','j':'B'};
document.addEventListener('keydown', ev=>{
  if(ev.target.tagName==='INPUT'||ev.target.tagName==='SELECT') return;
  const n=KB_MAP[ev.key.toLowerCase()];
  if(n && !held['kb_'+n]){
    holdNote('kb_'+n, getNoteFreq(n, octave));
    showActiveNote(n, octave);
    document.querySelectorAll('.key').forEach(k=>{ if(k.dataset.note===n && parseInt(k.dataset.oct)===octave) k.classList.add('pressing'); });
  }
});
document.addEventListener('keyup', ev=>{
  const n=KB_MAP[ev.key.toLowerCase()];
  if(n){
    releaseNote('kb_'+n);
    document.querySelectorAll('.key').forEach(k=>{ if(k.dataset.note===n) k.classList.remove('pressing'); });
  }
});

// ────────────────────────────────────────────────
// CHORD BUILDER
// ────────────────────────────────────────────────
let chordRoot='C', chordQuality='Major';
let scaleRoot='C', scaleType='Major';

function buildChordUI() {
  const rg=document.getElementById('chordRootGroup');
  const qg=document.getElementById('chordQualityGroup');
  if(!rg||!qg) return;

  CIRCLE_5TH.forEach(n=>{
    const p=document.createElement('div');
    p.className='pill'+(n===chordRoot?' active':'');
    p.textContent=n;
    p.onclick=()=>{ chordRoot=n; rg.querySelectorAll('.pill').forEach(x=>x.classList.remove('active')); p.classList.add('active'); updateChordDisplay(); };
    rg.appendChild(p);
  });
  Object.keys(CHORD_TYPES).forEach(q=>{
    const p=document.createElement('div');
    p.className='pill'+(q===chordQuality?' active':'');
    p.textContent=q;
    p.onclick=()=>{ chordQuality=q; qg.querySelectorAll('.pill').forEach(x=>x.classList.remove('active')); p.classList.add('active'); updateChordDisplay(); };
    qg.appendChild(p);
  });
  updateChordDisplay();
}

function updateChordDisplay() {
  document.getElementById('chordResultName').textContent=chordRoot+' '+chordQuality;
  const root=NOTES.indexOf(chordRoot.replace('b','b').replace('♯','#')); // normalize
  const rootIdx=CIRCLE_5TH.indexOf(chordRoot);
  const map={'Db':1,'Eb':3,'Gb':6,'Ab':8,'Bb':10,'F#':6,'C#':1};
  const ri=map[chordRoot]!==undefined?map[chordRoot]:NOTES.indexOf(chordRoot);
  const notes=CHORD_TYPES[chordQuality].map(i=>DISPLAY[(ri+i)%12]);
  document.getElementById('chordResultNotes').textContent=notes.join(' – ');
}

function playChord() {
  initAudio();
  const map={'Db':1,'Eb':3,'Gb':6,'Ab':8,'Bb':10,'F#':6,'C#':1};
  const ri=map[chordRoot]!==undefined?map[chordRoot]:NOTES.indexOf(chordRoot);
  CHORD_TYPES[chordQuality].forEach((iv,i)=>{
    const n=NOTES[(ri+iv)%12];
    setTimeout(()=>playTone(getNoteFreq(n,4), 2), i*60);
  });
}

// ────────────────────────────────────────────────
// SCALE EXPLORER
// ────────────────────────────────────────────────
function buildScaleUI() {
  const srg=document.getElementById('scaleRootGroup');
  const stg=document.getElementById('scaleTypeGroup');
  if(!srg||!stg) return;
  CIRCLE_5TH.forEach(n=>{
    const p=document.createElement('div');
    p.className='pill'+(n===scaleRoot?' active':'');
    p.textContent=n;
    p.onclick=()=>{ scaleRoot=n; srg.querySelectorAll('.pill').forEach(x=>x.classList.remove('active')); p.classList.add('active'); renderScale(); };
    srg.appendChild(p);
  });
  Object.keys(SCALE_TYPES).forEach(s=>{
    const p=document.createElement('div');
    p.className='pill'+(s===scaleType?' active':'');
    p.textContent=s;
    p.onclick=()=>{ scaleType=s; stg.querySelectorAll('.pill').forEach(x=>x.classList.remove('active')); p.classList.add('active'); renderScale(); };
    stg.appendChild(p);
  });
  renderScale();
}

function renderScale() {
  const map={'Db':1,'Eb':3,'Gb':6,'Ab':8,'Bb':10,'F#':6,'C#':1};
  const ri=map[scaleRoot]!==undefined?map[scaleRoot]:NOTES.indexOf(scaleRoot);
  const {intervals,steps}=SCALE_TYPES[scaleType];
  const notes=intervals.map(i=>DISPLAY[(ri+i)%12]);
  const row=document.getElementById('scaleNotesRow');
  row.innerHTML='';
  notes.forEach(n=>{
    const p=document.createElement('div');
    p.className='scale-note-pill'; p.textContent=n;
    p.onclick=()=>{ const ni=NOTES.indexOf(n.replace('♯','#')); playTone(getNoteFreq(NOTES[ni]||'A',4),0.7); };
    row.appendChild(p);
  });
  document.getElementById('scaleIntervals').textContent=steps;
}

function playScale() {
  const map={'Db':1,'Eb':3,'Gb':6,'Ab':8,'Bb':10,'F#':6,'C#':1};
  const ri=map[scaleRoot]!==undefined?map[scaleRoot]:NOTES.indexOf(scaleRoot);
  SCALE_TYPES[scaleType].intervals.forEach((iv,i)=>{
    const n=NOTES[(ri+iv)%12];
    setTimeout(()=>playTone(getNoteFreq(n,4),0.6), i*280);
  });
}

// ────────────────────────────────────────────────
// AUDIO FILE ANALYSIS
// ────────────────────────────────────────────────
let audioFile=null;

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('dropZone').classList.remove('drag-over');
  const f=e.dataTransfer.files[0];
  if(f?.type.startsWith('audio')) setAudioFile(f);
}
function handleFileSelect(e) {
  const f=e.target.files[0];
  if(f) setAudioFile(f);
}
function setAudioFile(f) {
  audioFile=f;
  const chip=document.getElementById('fileChip');
  chip.textContent='🎵 '+f.name+' ('+Math.round(f.size/1024)+' KB)';
  chip.classList.remove('hidden');
  document.getElementById('analyzeBtn').disabled=false;
}

async function runAnalysis() {
  if(!audioFile) return;
  const btn=document.getElementById('analyzeBtn');
  btn.disabled=true; btn.textContent='Analyzing…';
  document.getElementById('analysisResults').innerHTML='<div class="ai-loading"><div class="dot-loader"><span></span><span></span><span></span></div> Processing audio…</div>';
  document.getElementById('aiPanel').style.display='none';

  initAudio();
  let ab;
  try {
    ab=await audioCtx.decodeAudioData(await audioFile.arrayBuffer());
  } catch(err) {
    document.getElementById('analysisResults').innerHTML='<div style="color:#fb7185">Could not decode audio. Try MP3 or WAV.</div>';
    btn.disabled=false; btn.textContent='Analyze Audio'; return;
  }

  const data=ab.getChannelData(0);
  const sr=ab.sampleRate;
  const freq=detectFundamental(data,sr);
  const note=freqToNote(freq);
  const bpm=estimateBPM(data,sr);
  const rms=Math.sqrt(data.slice(0,sr).reduce((a,v)=>a+v*v,0)/Math.min(data.length,sr));
  const reg=getRegion(freq);
  const keySig=KEY_SIGS[note]||'—';

  document.getElementById('analysisResults').innerHTML=`
    <div class="results-cards">
      <div class="rc"><div class="rc-label">Root Note</div><div class="rc-val">${note}</div><div class="rc-sub">Fundamental</div></div>
      <div class="rc"><div class="rc-label">Frequency</div><div class="rc-val">${freq.toFixed(0)}</div><div class="rc-sub">Hz</div></div>
      <div class="rc"><div class="rc-label">Est. BPM</div><div class="rc-val">${bpm}</div><div class="rc-sub">Tempo</div></div>
      <div class="rc"><div class="rc-label">Spectrum</div><div class="rc-val" style="font-size:0.85rem;color:${reg.color}">${reg.name}</div><div class="rc-sub">Region</div></div>
      <div class="rc"><div class="rc-label">Dynamic</div><div class="rc-val">${Math.round(rms*100)}</div><div class="rc-sub">RMS level</div></div>
      <div class="rc"><div class="rc-label">Duration</div><div class="rc-val">${ab.duration.toFixed(1)}s</div><div class="rc-sub">${(sr/1000).toFixed(1)} kHz</div></div>
    </div>
  `;

  btn.disabled=false;
  const btnEl=document.getElementById('analyzeBtn');
  btnEl.innerHTML='<svg width="16" height="16" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M6 5.5l4 2.5-4 2.5V5.5z" fill="currentColor"/></svg> Analyze Audio';

  // AI analysis
  document.getElementById('aiPanel').style.display='block';
  document.getElementById('aiBody').innerHTML=`<div class="ai-loading"><div class="dot-loader"><span></span><span></span><span></span></div> Generating harmonic insight…</div>`;

  try {
    const r5th=CIRCLE_5TH.indexOf(note);
    const maj3rd=NOTES[(NOTES.indexOf(note)+4)%12];
    const maj3rd2=NOTES[(NOTES.indexOf(note)+8)%12];
    const prompt=`You are a music theory expert specializing in jazz harmony and the Circle of Fifths. Analyze this audio data concisely:
- Detected root note: ${note} at ${freq.toFixed(1)} Hz
- Estimated tempo: ${bpm} BPM  
- Spectral region: ${reg.name}
- Key signature: ${keySig}
- Duration: ${ab.duration.toFixed(1)} seconds

Provide exactly 4 sentences: (1) Identify the key and what emotions/mood this tonal center typically evokes. (2) Describe its position on the Circle of Fifths and name its closest neighbors. (3) In Coltrane's Giant Steps matrix, note that ${note} → ${maj3rd} → ${maj3rd2} forms a major-thirds cycle — comment on the harmonic tension this creates. (4) Suggest 2-3 chord progressions that work beautifully in this key.`;

    const res=await fetch('https://api.anthropic.com/v1/messages',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        model:'claude-sonnet-4-20250514',
        max_tokens:1000,
        messages:[{role:'user',content:prompt}]
      })
    });
    const json=await res.json();
    const text=(json.content||[]).map(c=>c.text||'').join('');
    document.getElementById('aiBody').innerHTML=`<p>${text || 'Analysis complete. The detected root note ' + note + ' appears in the ' + reg.name + ' spectrum.'}</p>`;
  } catch(e) {
    const maj3rd=NOTES[(NOTES.indexOf(note)+4)%12];
    const maj3rd2=NOTES[(NOTES.indexOf(note)+8)%12];
    document.getElementById('aiBody').innerHTML=`<p>Root note <strong>${note}</strong> at ${freq.toFixed(1)} Hz falls in the <strong style="color:${reg.color}">${reg.name}</strong> spectrum region. On the Circle of Fifths, its dominant is ${NOTES[(NOTES.indexOf(note)+7)%12]} and its subdominant is ${NOTES[(NOTES.indexOf(note)+5)%12]}. In Coltrane's Giant Steps matrix, the major-thirds cycle ${note} → ${maj3rd} → ${maj3rd2} creates powerful harmonic movement through three equidistant tonal centers. Key signature: <strong>${keySig}</strong>.</p>`;
  }
}

function detectFundamental(data, sr) {
  const N=Math.min(data.length,sr);
  let best=sr/400, bestCorr=0;
  for(let p=Math.floor(sr/1200); p<Math.floor(sr/60); p++){
    let c=0;
    for(let i=0;i<2048;i++) c+=data[i]*data[(i+p)%N];
    if(c>bestCorr){ bestCorr=c; best=p; }
  }
  return sr/best;
}

function estimateBPM(data,sr){
  const dur=data.length/sr;
  const hop=Math.floor(sr*0.01);
  const env=[];
  for(let i=0;i<data.length-hop;i+=hop){
    let e=0;for(let j=0;j<hop;j++)e+=Math.abs(data[i+j]);env.push(e/hop);
  }
  let peaks=0;
  for(let i=1;i<env.length-1;i++) if(env[i]>env[i-1]&&env[i]>env[i+1]&&env[i]>0.015)peaks++;
  return Math.max(60,Math.min(220,Math.round((peaks/dur)*60)));
}

// ────────────────────────────────────────────────
// TAB NAVIGATION
// ────────────────────────────────────────────────
function switchTab(name) {
  document.querySelectorAll('.tab-section').forEach(s=>s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  const sec=document.getElementById('tab-'+name);
  if(sec){ sec.classList.add('active'); sec.classList.add('fade-in'); }
  document.querySelector(`.nav-btn[data-section="${name}"]`)?.classList.add('active');
  // Hide hero when not on default
  if(name!=='explore') document.getElementById('heroSection').style.paddingBottom='0';
  if(name==='play') buildKeyboard();
}

// ────────────────────────────────────────────────
// INIT
// ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', ()=>{
  drawCircle();
  drawColtrane();
  buildChordUI();
  buildScaleUI();
  // lazy init audio on first interaction
  document.body.addEventListener('click', ()=>{ if(!audioCtx) initAudio(); }, {once:true});
});
