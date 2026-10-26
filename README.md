game is live at https://erenrodin22.github.io/neonvoid3d/
# NEON VOID

A fast-paced top-down wave survival shooter built with **vanilla JavaScript and HTML5 Canvas**. No engines, no dependencies, no assets: all visuals are drawn in code and all sound is synthesized with the Web Audio API.

## Play

Open `index.html` in any modern browser, or serve the folder locally:

```bash
npx serve .
```

## Controls

| Input | Action |
|-------|--------|
| `W A S D` / Arrow keys | Move |
| Mouse | Aim and shoot |
| `Space` | Dash (brief invulnerability) |
| `1` `2` `3` / Click | Pick an upgrade between waves |

## Features

- Wave-based progression with scaling difficulty and a **boss every 5th wave**
- Three enemy archetypes (chaser, shooter, tank) with distinct behaviours
- Roguelite upgrade picks between waves: multishot, piercing, fire rate, dash cooldown and more
- Combo score multiplier, health pickups with magnet pull
- Screen shake, particle bursts, neon glow rendering
- Procedural sound effects (Web Audio), persistent high score (localStorage)
- Frame-rate independent logic (delta-time), responsive canvas

## Code structure

`game.js` is organised into clear sections: input, audio, state, spawning, effects, upgrades, update, rendering and main loop.

## License

MIT
