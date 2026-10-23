# Pomodio

Pixel-art three.js park diorama + Pomodoro timer. Vanilla JS ES modules, built by Vite into ONE self-contained `dist/index.html` (`vite-plugin-singlefile`). three.js loads from the jsDelivr CDN (import map in `index.html` + alias in `vite.config.js`).

- Package manager: pnpm. `pnpm dev` — dev server; `pnpm build` — writes `dist/index.html` (the deliverable).
- Open only the module you need; the file map below says where things live.

## File map
- `index.html` — markup (panels, splash, SVG icon sprite) + import map
- `src/style.css` — all styles
- `src/main.js` — entry: imports CSS, main `frame()` loop
- `src/utils.js` — math/random helpers, `store` (localStorage), `$`, `ico`
- `src/state.js` — `state` (hour/live/weather/tilt), weather `PRESETS`, live weather blend `W`
- `src/renderer.js` — renderer, camera, OrbitControls, `updateCamera` (`camAz`/`camRight`), tilt-shift passes, `resize`
- `src/textures.js` — procedural pixel textures
- `src/ground.js` — city layout zones, ground canvas
- `src/shaders.js` — water, ground fog, particle shaders
- `src/lights.js` — hemi + sun
- `src/city.js` — buildings, lamps, trees, park props, fountain, canal, market, court
- `src/nav.js` — navigation graph
- `src/sprites.js` — sprite sheets (people, bikes, dogs, umbrellas, bubbles)
- `src/audio.js` — Web Audio engine `sound`, `syncAudioUI`
- `src/citizens.js` — agents, roles, cast spawning
- `src/traffic.js` — red double-decker bus driving the avenue between the two stops
- `src/particles.js` — petals, dust, fireflies, rain, splashes
- `src/weather.js` — time of day & weather (`env`, `updateEnvironment`, lightning)
- `src/pomodoro.js` — timer logic (`pomo`)
- `src/ui.js` — DOM wiring, keyboard, NPC picking + card

## Rules
- Imports only point "up" this list (utils → … → ui → main); keep the graph acyclic so module evaluation order stays correct.
- A module can't assign another module's `let` export — put the write in the owning module (see `updateCamera`).
- `build.cssMinify` is off on purpose: the minifier breaks `backdrop-filter: blur() saturate()`.
