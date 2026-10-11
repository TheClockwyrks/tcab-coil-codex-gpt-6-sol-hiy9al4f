# Coil

Coil is a neon grid serpent played entirely in the browser. Steer through an enclosed board, eat pellets to grow, and collect them quickly to raise a timed score multiplier. The wall and your own body end a round.

## Run

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. To make a static site, run `npm run build` and serve the `dist/` directory. The build bundles the committed sprites and audio files under `assets/`; it does not regenerate them. `npm run preview` serves a production build locally.

## Controls

| Action | Keys |
| --- | --- |
| Steer | Arrow keys or WASD |
| Select menu item | Enter or Space |
| Back / pause | Escape |
| Pause / resume | P |
| Toggle sound | M |
| Debug overlay | Backtick |

Menus also support pointer and touch selection. The on-screen direction pad appears on touch devices.

## Development checks

Run `npm run typecheck`, `npm run lint`, `npm run format`, and `npm test` to validate the source.
