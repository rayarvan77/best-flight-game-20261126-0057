# Crimson Canyon — Ring Run

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/rayarvan77/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/rayarvan77/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A flight game for [make.fun](https://make.fun) — fly the red-and-white prop plane **Kestrel** through 8 glowing rings over a golden-hour river canyon, then bring her down on the valley runway.

## The game

- **The course:** a winding canyon carved by a river, with ridge noise, a sandy valley floor and the sun low in the west. Eight rings weave along the river's line, climbing and dipping, and the runway waits at the valley's end with a windsock and hangars.
- **The flying:** a real-feeling arcade flight model — throttle, pitch, bank and rudder, turns that follow the bank, lift that falls away below stall speed, and a crash when the canyon floor arrives too fast. Land gently, on the strip and lined up, and the run is complete.
- **The views:** chase camera by default, cockpit camera on `C` — the panel carries a lit artificial horizon, altimeter, airspeed dial, heading tape and warning lamps. The HUD always shows altitude, speed, heading, vertical speed, throttle, rings, score and time.
- **The sound:** engine hum, wind and ring chimes, all synthesised with WebAudio. No audio file is loaded.
- **The goal:** all 8 rings (+100 each), then a landing (+250) and a time bonus. Your best landing time is kept in the browser.

## Controls

| Key | Action |
| --- | --- |
| `W` / `S` | Throttle up / down |
| `↑` / `↓` | Pitch up / down (climb / dive) |
| `←` / `→` | Bank left / right (banking turns the plane) |
| `A` / `D` | Rudder (yaw) |
| Mouse | Steers like a stick when no key is held |
| `C` | Chase / cockpit camera |
| `P` or `Esc` | Pause |
| `M` | Sound on / off |
| `Space` / click | Start, restart |
| `R` | Fly again after a crash or landing |

## Play it

No build step, no network: serve `game/` with any static server and open it in desktop Chrome.

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

Or open `game/index.html` through any static file server. `?seed=N` fixes the canyon; `?shot=start|play|cockpit|end&seed=1` stages the screenshot scenes (the autopilot flies them).

## Layout

- `game/` — the playable game: `index.html` plus ES modules under `game/src/` (flight model, terrain, renderer, instruments, autopilot, input, sound).
- `screenshots/` — 4 real renders of the game's own code: title, chase play, cockpit, landing.
- `main.ts` — the hand-in program (Node 22, standard library only): copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored make.fun library.
- `vendor/makefun-game.ts` — the kit's library, copied unchanged.

## Entry

- **Bounty:** [Make the best flight game — make.fun](https://make.fun/bounty/best-flight-game-20261126-0057)
- **Reward:** $500 shared by the top 50 (1st $100) · **Deadline:** 28 Nov 2026, 00:57 UTC (07:57 WIB)
- **License:** MIT — see [LICENSE](LICENSE).
