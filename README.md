# Quantum Fingerprint

A small web app that turns real quantum-beacon randomness into a unique
visual pattern. Every generated image is different because the underlying
random data is different -- nothing about the picture is pre-made or
templated.

## What it does

1. Fetches a random data pulse from CURBy (`random.colorado.edu`), a public
   randomness beacon run by CU Boulder / NIST.
2. Runs a basic statistical check on that data (is it actually well-balanced
   and unpredictable, or is something off).
3. Uses the random bytes to decide every visual parameter of the pattern --
   number of points, their distance from center, their color, their size.
   Nothing is hardcoded or randomly chosen by a separate, unrelated source.
4. Draws the result on an HTML canvas in the browser.

Same input bytes always produce the same picture. Different input bytes
(every click) produce a different one. That link is intentional -- the
picture is a direct, visible consequence of the randomness, not decoration
next to it.

## Why it's built this way

CURBy's live quantum photon source is currently offline for maintenance
(publicly stated on their site, and confirmed here by checking the same
pulse twice and seeing identical data). Rather than hide that, this app
mixes CURBy's data with a fresh local random value and a timestamp, so the
result is still different every time even while the upstream source is
static. The app tells you honestly which mode produced a given result
(`curby-quantum`, `curby-classical`, or `local-fallback`) instead of always
claiming "quantum."

## Tech stack

- Next.js (App Router) + TypeScript
- No external drawing/animation libraries -- plain HTML canvas
- No native/compiled dependencies -- runs the same way on Windows, macOS,
  Linux, and ARM (e.g. Raspberry Pi) with just `npm install`

## Project structure

```
app/
  page.tsx              -- the UI and canvas drawing logic
  api/entropy/route.ts  -- server-side endpoint that fetches and checks entropy
lib/
  curby.ts               -- entropy fetching, mixing, and statistical checks
```

## Running it locally

```bash
npm install
npm run dev
```

Open http://localhost:3000, click "Generate My Fingerprint."

## Known limitations

- The statistical health check runs on a small sample (~64 bytes per
  pulse), so it's an indicative sanity check, not a certified randomness
  evaluation.
- CURBy's live quantum source is currently unavailable upstream (see
  above); the app is built to work correctly either way.

