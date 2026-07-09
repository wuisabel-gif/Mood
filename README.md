# Mood — Algorithmic Mood Music

**Mood** turns a *feeling* into a short two-voice study (melody + bass). Pick a mood, shape the vibe, hear it instantly in the browser, and download the MIDI to take into a DAW.

Variety comes from the **mood**, not from an algorithm: each mood sets its own musical mode, tempo, register, rhythm, melodic contour, dynamics, and instrument timbre. Energy, tempo, instrument, and duration fine-tune it, and the seed gives fresh variations every generation — deterministically.

The project ships as a **fully static website** — no backend, no API keys, GitHub-Pages-ready.

## The moods

| Mood | Mode | Feel | Generated title |
| --- | --- | --- | --- |
| **Chill** 😌 | Dorian | relaxed, calm | Midnight Whispers |
| **Melancholic** ☁️ | Aeolian | sad, reflective | Rain on Glass |
| **Happy** ☀️ | Ionian (major) | uplifting, bright | Golden Bloom |
| **Focused** ⛰️ | Mixolydian | productive, flow | Deep Signal |
| **Sleepy** 🌙 | Lydian | restful, peaceful | Moonlit Drift |
| **More** ✨ | — | surprise me | (random mood) |

## Features

- Mood-driven, two-voice generation in-browser (no backend, no paid APIs)
- Customize panel: **Energy** + **Tempo** sliders, **Instrument** (Piano, Guitar, Strings, Synth, Flute, Lo-fi), **Duration**
- Now Playing panel with animated waveform, transport controls, and volume
- In-browser playback (Web Audio API) with instrument-specific timbre
- Self-contained MIDI export written in pure JS (no external libraries)
- Scene presets (Rainy Night, Sunset Drive, Forest Walk, Deep Focus)
- Deterministic output — same mood + settings + seed → same piece
- Keyboard-accessible mood selector, responsive to mobile, reduced-motion aware

## Project Layout

```text
music-generator/
  README.md
  PRODUCT.md            # product/brand context for design work
  index.html            # static entry point (Mood dashboard)
  static/
    app.js              # Mood engine + playback + MIDI export (browser)
    styles.css          # Dark-neon glassmorphism theme

  generate.py           # Optional legacy Python CLI (algorithmic modes)
  web_app.py            # Optional local Python server (serves index.html)
  engine/
    __init__.py
    scales.py
    rhythm.py
    modes.py            # stack / queue / dfs / recursion transforms (CLI only)

  requirements.txt
```

## Run Locally

The app is fully static — no build, no backend.

```bash
git clone git@github.com:wuisabel-gif/Mood.git
cd Mood
python3 -m http.server 8080
```

Then open [http://127.0.0.1:8080](http://127.0.0.1:8080). (`web_app.py` is an optional
alternative server if you prefer one that mirrors the same routes.)

## Deploy

Since it's static, drop the repo on any static host — GitHub Pages, Netlify, or
Vercel — and point it at the root. No environment variables or server needed.

## Optional: Legacy Python CLI (algorithmic)

The original CS-inspired generator (`stack`, `queue`, `dfs`, `recursion`) still lives in `generate.py` for file-based MIDI output:

```bash
pip install -r requirements.txt
python generate.py \
  --mode dfs --key D --scale minor \
  --tempo 112 --bars 16 --seed 7 \
  --out dfs_dminor.mid --txt-out dfs_dminor_notes.txt
```

This path is independent of the Mood website above.

A fixed seed always yields the same notes; `python3 test_generate.py` pins that.

## Copyright

Copyright (c) 2026 Isabel Wu. All rights reserved.
