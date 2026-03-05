# 🎵 HarmonicFlow

> AI-powered musical harmony explorer with Circle of Fifths, Coltrane Matrix, live synthesis, and audio analysis.

**[Live Demo →](https://charismaforever.github.io/Harmonic-Flow/)**

---

## Features

### 🔵 Explore
- **Interactive Circle of Fifths** — click any note to hear it and see its frequency, MIDI number, key signature, and major scale
- Toggle **relative minor keys** overlay
- **Chord highlighting** — see harmonically related keys glow
- **Coltrane Matrix** — John Coltrane's Giant Steps major-thirds cycle, fully interactive and rotatable
- **Live Frequency Analyzer** — real-time spectrum and waveform display, logarithmic frequency position bar

### 🎤 Analyze
- **Upload audio files** (MP3, WAV, OGG, M4A) via drag-and-drop
- Detects **root note**, dominant frequency, estimated **BPM**, spectral region, RMS level
- **AI-powered harmonic insight** — GPT-style analysis of Circle of Fifths position, Coltrane matrix relationships, and chord suggestions

### 🎹 Play
- **Synthesizer keyboard** (2 octaves) with mouse, touch, and **computer keyboard** support
  - Keys: `A W S E D F T G Y H U J` (white/black keys)
- Switchable waveforms: **Sine, Triangle, Sawtooth, Square**
- **ADSR-style** attack/release envelopes with reverb
- **Chord Builder** — pick root + quality, play voiced chords
- **Scale Explorer** — 8 scales (Major, Minor, Dorian, Lydian, Blues, Pentatonic, and more)

### 📖 Theory
- Deep-dive reference cards: Circle of Fifths, Coltrane's Giant Steps, frequency/spectrum, waveform types, chord theory, modal scales

---

## Deploy to GitHub Pages

1. Fork or clone this repository
2. Go to **Settings → Pages**
3. Set source to **Deploy from branch** → `main` → `/ (root)`
4. Your app will be live at `https://charismaforever.github.io/Harmonic-Flow/`

## Local Development

Just open `index.html` in your browser — no build step required! It's pure HTML/CSS/JS.

```bash
git clone https://github.com/charismaforever/Harmonic-Flow.git
cd harmonicflow
open index.html  # macOS
# or: python3 -m http.server 8080
```

---

## Tech Stack

- **Vanilla JS** — Web Audio API for synthesis and analysis
- **Canvas 2D** — all visualizations hand-drawn
- **Anthropic Claude API** — AI harmonic analysis (claude-sonnet-4)
- **CSS custom properties** — full theming system
- **Google Fonts** — Orbitron + DM Sans + DM Mono

---

## License

MIT © HarmonicFlow
