# Recursion Er Gaan: implementation plan

## Context

Hub's Quest Epoch 1 (UIU Developers Hub) is a solo creative-coding hackathon. The brief (`ref/Hub's Quest_ epoch 1.0.pdf`) asks for an interactive app that takes one recursive function, simulates and visualises it, and turns its behaviour into relaxing music that the user can play, control and download.

**Mandatory deliverables, each mapped to a piece of this plan:**

| # | Deliverable | Where it lives |
|---|---|---|
| 1 | Recursive algorithm with configurable parameters | `src/recursion/branch.ts` + control panel |
| 2 | Interactive simulation / visualisation | `src/viz/` (growing tree canvas + live call stack) |
| 3 | Procedural music driven by the recursion | `src/music/mapping.ts`, `src/music/engine.ts` |
| 4 | UI with parameter controls and playback | `src/ui/` |
| 5 | Working audio export | `src/export/` (WAV via offline render, plus MIDI) |
| 6 | Polished, accessible, relaxing experience | design system, a11y pass, focus mode |

**Scoring weights:** relaxation/UX 35, musical quality 25, creative recursion 15, visual design 10, interaction/usability 10, technical 5. 60% of the score is "does it feel calm and sound good", so most of the effort goes into the audio engine and the feel of the app. Technical polish comes after that.

**Disqualification risk:** the brief says that if AI agents are used, the repo **must contain the prompt chain and the agent's response to each prompt**. That gets its own workstream (Phase 7) and starts with this conversation.

The project folder is empty apart from `ref/`, which must stay out of git.

---

## Concept: "Recursion Er Gaan"

The project is called **Recursion Er Gaan** ("the song of recursion"). Repo slug: `recursion-er-gaan`. One recursive function, `grow()`, draws a fractal plant. Every call to it plays a note. You hear the recursion go down (the plant branching into higher, finer voices) and come back up (the unwinding brings in resolving low tones). The base case, a leaf, plays a soft chime and the leaf blooms on screen.

The recursion is the score itself, so the "creative use of recursion" marks come from the structure: call order sets the melody, call depth sets register and timbre, the call stack sets the harmony, and the base case sets the texture.

```ts
grow(depth, length, angle, heading, path): void
  emit({ type: 'enter', depth, length, angle, heading, path, t })
  if (depth === 0 || length < minLength) { emit({ type: 'leaf', ... }); return }
  for (i of children(branchFactor))       // 2–3 children, angle spread ± jitter (seeded)
    grow(depth - 1, length * ratio, spread_i, heading + spread_i, [...path, i])
  emit({ type: 'return', depth, ... })    // unwinding event
```

The function is pure and deterministic because it uses a seeded PRNG (mulberry32). It returns a flat event timeline plus a node list for drawing. The total node count is capped at about 1500 so deep, wide settings can't flood the audio.

### Parameters the user controls
- **Depth** 1–9
- **Branches per call** 2–3
- **Spread angle** 10°–60°
- **Length ratio** 0.55–0.85: how fast branches shrink, which also sets note length
- **Wildness** 0–1: seeded jitter on angle and length
- **Seed**: number field plus a "new seed" button
- **Tempo** 48–84 BPM. The range stays slow on purpose.
- **Key + mode**: major pentatonic, minor pentatonic, Dorian, Lydian, Hirajōshi. Every option is consonant by design.
- **Mix**: drone / melody / chimes / ambience levels, plus reverb size

### Recursion → music mapping (`src/music/mapping.ts`)
| Recursive property | Musical element |
|---|---|
| Call order (DFS) | Melody sequence, one note per `enter` |
| Heading of the branch (cumulative turn) | Scale degree. Turning left goes up a step, turning right goes down. Quantised to the chosen mode. |
| Depth | Register (trunk low, twigs high) and instrument layer |
| Branch length | Note duration and velocity |
| `return` events | Soft low "resolve" tones on the chord root, and rests in the rhythm |
| Top-level subtree index | Chord for that section. Each child of the trunk is a phrase with its own chord (I–vi–IV–V-style walk derived from that branch's angle). |
| Leaf (base case) | Glassy chime with long reverb and a slight random pan |
| Number of active branches | Ambient wind/noise level and filter cutoff |

Rhythm: events go onto a 16th-note grid. Deeper calls subdivide the time of their parent, so the rhythm is self-similar: a parent gets a beat and its children share that beat. Deep levels thin out by probability (driven by Wildness) so the texture stays sparse and doesn't get busy.

### Sound design (`src/music/engine.ts`), built with Tone.js
- **Drone layer** (depth 0–1): two detuned `FatOscillator` sines through a slow-moving lowpass, sustaining on the chord root and fifth
- **Melody layer** (mid depths): soft `FMSynth` (bell/marimba) with gentle attack
- **Chime layer** (leaves): `MetalSynth` or a sine plus a high partial, with very long reverb
- **Ambience**: pink noise → bandpass → slow LFO, a synthesised "wind". An optional CC0 rain/stream loop from Pixabay is credited in the README.
- **Master chain**: Reverb (large, wet ~0.35) → FeedbackDelay (dotted 8th, low feedback) → Compressor → Limiter (−1 dB) → 2 s fade-in and fade-out on every start and stop, so there are no clicks or pops
- The graph is built by `buildGraph(context)` so **the same code path serves both live playback and offline export**

### Endless mode
When a tree finishes, the plant slowly crossfades into a new one (seed + 1, the same parameters). This gives a continuous evolving soundscape, which is the main relaxation feature. A **sleep timer** (15/30/60 min) fades everything out.

---

## Visual design

The tone is a quiet night garden, not a dashboard. The rules below are there to avoid the usual "AI-made" look.

- Full-bleed canvas. Background is deep ink green-black (`#0e1512`). Branches are warm paper tones (`#e8dcc4`). Leaves bloom in muted moss, apricot and dusty-rose. No purple-to-blue gradients, no glassmorphism cards, no emoji in the UI.
- Type: **Fraunces** (display, for the title and section labels) plus **IBM Plex Mono** (call-stack readout and numeric values), from Google Fonts. Body is **IBM Plex Sans**.
- The plant grows branch by branch in sync with the audio (`Tone.Draw.schedule`). The sounding branch glows briefly, and leaves open with a small particle bloom.
- **Call-stack panel**: a monospace column on the right showing the live stack, e.g. `grow(3, 41px, −22°)`, pushing and popping as the music plays. This makes the recursion visible and is the core of the "creative use of recursion" pitch.
- Controls live in a collapsible side drawer (bottom sheet on mobile). **Focus mode** (`F`) hides all chrome and leaves only the plant and the sound.
- `prefers-reduced-motion`: no particles. Branches appear with a simple fade instead.
- Run the `design-taste-frontend` skill as a review gate on the UI before submission.

---

## Tech stack

| Concern | Choice | Why |
|---|---|---|
| Build | **Vite + React 18 + TypeScript** | Fast, and deploys to GitHub Pages as static files |
| Audio | **Tone.js** | Transport, synths, effects, and `Tone.Offline` for export |
| MIDI export | **@tonejs/midi** | Exports the composition as notes as well as audio |
| UI primitives | **Radix UI** (Slider, Select, Switch, Tooltip, Dialog, ToggleGroup) | Accessible and keyboard-operable out of the box, with no imposed styles |
| Styling | **Tailwind CSS v4** with custom tokens | Our own palette, not the shadcn defaults |
| Icons | **lucide-react** | |
| State | **zustand** | Small store, params ↔ URL hash sync |
| Viz | Canvas 2D (HiDPI aware) | Handles 1500 animated nodes cheaply |
| Tests | **Vitest** | Tests the pure recursion and mapping modules |
| Deploy | GitHub Actions → GitHub Pages | Live demo link for the judges |

---

## Project structure

```
/
├─ index.html
├─ src/
│  ├─ main.tsx, App.tsx
│  ├─ recursion/   branch.ts (grow + types), rng.ts (mulberry32), timeline.ts (events → beat times)
│  ├─ music/       scales.ts, mapping.ts, engine.ts (buildGraph), ambient.ts, player.ts (live transport)
│  ├─ export/      wav.ts (AudioBuffer → 16-bit PCM WAV, hand-written), midi.ts, render.ts (Tone.Offline)
│  ├─ viz/         TreeCanvas.tsx, draw.ts, bloom.ts, CallStack.tsx
│  ├─ ui/          ControlDrawer.tsx, TransportBar.tsx, ExportDialog.tsx, PresetPicker.tsx, AboutDialog.tsx, controls/*
│  ├─ state/       store.ts, urlSync.ts, presets.ts
│  └─ styles/      index.css (tokens, light/dark not needed: night-only theme with AA contrast)
├─ tests/          branch.test.ts, mapping.test.ts, wav.test.ts
├─ public/         favicon.svg, og-image.png, audio/ (optional CC0 ambience)
├─ docs/
│  ├─ prompt-log/  (see Phase 7)
│  └─ screenshots/
├─ .github/workflows/deploy.yml
├─ README.md
├─ LICENSE (MIT)
└─ .gitignore
```

---

## Build phases

**Phase 0: Scaffold and repo hygiene**
- `npm create vite@latest . -- --template react-ts`, then install the dependencies above
- Write `.gitignore` (below), `git init`, create a branch, first commit
- Create `docs/prompt-log/` and log this planning session as entry 001

**Phase 1: Recursion core (pure TS, test-first)**
- `rng.ts`, `branch.ts`, `timeline.ts`
- Vitest checks: same seed gives the same events; node cap is respected; enter/return events are balanced; depth 0 produces exactly one leaf

**Phase 2: Music mapping and live engine**
- `scales.ts` (modes as semitone arrays), `mapping.ts` (events → `{time, note, dur, vel, layer}`), `engine.ts`, `player.ts`
- Tune by ear: several presets must sound good with no tweaking. **This is where most of the time goes (25% of the score).**

**Phase 3: Visualisation**
- Canvas renderer with growth animation driven by the same timeline, the active-branch glow, leaf bloom, and the CallStack panel, all synced through `Tone.Draw`

**Phase 4: UI and interaction**
- Drawer with Radix controls, transport bar (Play/Pause, Regrow, Endless toggle, Sleep timer, Volume)
- Changing a parameter regrows the plant smoothly with a crossfade; it never cuts the sound
- Presets: "Fern at dusk", "Willow", "Lantern bloom", "Deep roots", with hand-tuned values
- Keyboard: `Space` play/pause, `R` regrow, `N` new seed, `F` focus mode, `E` export, `?` shortcuts dialog
- Parameters sync to the URL hash so a link can be shared

**Phase 5: Export**
- WAV: `Tone.Offline(() => buildGraph(...), duration)` → `wav.ts` → download `recursion-er-gaan-<seed>.wav`, with a progress state in the dialog
- MIDI: one track per layer via @tonejs/midi
- PNG snapshot of the plant (canvas `toBlob`)
- Endless mode exports a chosen length (1/3/5 min)

**Phase 6: Relaxation and accessibility polish**
- Onboarding is one quiet first screen ("Put on headphones. Press play.") and nothing more
- Contrast check against WCAG AA, visible focus rings, `aria-label` on every control, an `aria-live` region announcing state ("Growing, depth 6, seed 4127"), full keyboard operability, reduced-motion support, and a mobile layout
- Master loudness check: no peaks above −1 dBFS, and no harsh frequencies (gentle high-shelf cut)
- Run the `design:accessibility-review` skill as a gate

**Phase 7: Prompt log (mandatory, disqualification risk)**
- `docs/prompt-log/README.md` explains the tools used and the order of prompts
- Each prompt gets one file, `NNN-short-title.md`, containing **the exact prompt** and **the agent's full response** (including the plan and a summary of the code changes)
- Add `scripts/export-prompt-log.mjs` to convert Claude Code session transcripts (`~/.claude/projects/<project>/*.jsonl`) into these markdown files. It keeps user prompts and assistant text, strips system reminders and tool noise, and **redacts the email address and other personal details** before anything is written.
- Update the log after every working session, not at the end

**Phase 8: README, deploy, submit**
- README: one-line pitch, live demo link, GIF, "How the recursion becomes music" (the mapping table plus a small diagram), controls and shortcuts, how to run locally, credits/licences, link to the prompt log
- Run all public copy through the `humanizer` skill: plain sentences, no hype words, no "seamless/immersive journey" filler
- GitHub Actions workflow builds and deploys to Pages (`base: '/recursion-er-gaan/'` in `vite.config.ts`). The `<title>`, favicon wordmark, README heading and About dialog all use "Recursion Er Gaan".
- Push to GitHub

---

## `.gitignore`

```gitignore
# Hackathon reference material (not ours to publish)
ref/

# Dependencies
node_modules/

# Build output
dist/
dist-ssr/
*.local

# Test / coverage
coverage/

# Logs
logs/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Env / secrets
.env
.env.*
!.env.example

# Editor / OS
.vscode/*
!.vscode/extensions.json
.idea/
.DS_Store
Thumbs.db
desktop.ini

# Local agent settings (keep prompt log in docs/, not these)
.claude/settings.local.json

# Local test renders
exports/
*.wav
!public/audio/*.wav
```

---

## Verification

- `npm test`: recursion determinism, event balance, node cap, mapping stays in scale, WAV header and length correct
- `npm run build && npm run preview`: the production build runs with no console errors
- Manual listening pass on each preset and at extreme parameters (depth 9 × 3 branches, depth 1). There should be no clipping, no clicks on start, stop or regrow, and nothing harsh.
- Export: download the WAV, open it in Audacity or VLC, and confirm it matches the live playback and the length is right. Import the MIDI into a DAW or an online MIDI player.
- Keyboard-only run-through of the whole app; Lighthouse accessibility ≥ 95; test in Chrome, Firefox, and a mobile viewport
- Check the deployed GitHub Pages URL in a clean browser
- `git status` / `git ls-files | grep ref` must show that `ref/` is not tracked
- `docs/prompt-log/` covers every session, with no personal data in it
