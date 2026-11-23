# Vista Bay

A sun-soaked 3D open-world crime game in the spirit of GTA 6, built from
scratch for the make.fun **gta6-01** competition. Everything is original:
the city, the characters, the story, the art and the sounds.

## The city

Vista Bay is a 600 × 600 m procedural city on the coast: a downtown of
glass towers with lit windows, a beach with a wooden pier and a lighthouse,
a palm-lined beach avenue, the Golden Palm Casino, Vista General Hospital,
Palm Park, a container port and an airport with a runway. Sunny afternoon
light, sea haze and fog. It runs entirely offline — Three.js r160 is
vendored under `game/vendor/`, and the game makes zero network requests.

## How to play

Open `game/index.html` from any static server (for example `node serve.ts`,
then http://localhost:8080) in desktop Chrome. No build step, no install.

| Key | Action |
| --- | --- |
| WASD / arrows | Walk, or drive when in a car |
| Mouse drag | Orbit the third-person camera (it follows you otherwise) |
| Click | Fire the pistol |
| E | Steal a parked car / get out of a car (stealing is a crime) |
| F | Punch |
| R | Reload |
| Shift | Run |
| M | Big map (the circular minimap is always on) |
| P / Esc | Pause (progress saves) |

## Systems

- **Driving & traffic** — 26 AI cars flowing on the street grid, 18
  parked cars you can steal, arcade handling with braking, reversing and
  collisions.
- **Pedestrians** — 42 walkers on the sidewalks who run when they hear
  gunfire.
- **Wanted level** — 5 stars. Stealing and shooting draw the Bay PD:
  patrol cars chase and ram you, foot cops try to arrest you, and at 4+
  stars roadblocks appear. Lay low and out of sight and the heat cools
  down. Getting busted or wasted costs 20% of your cash and you wake up at
  the hospital.
- **Combat** — pistol with raycast shots and tracers, melee punches,
  enemies who shoot back, and cars that take damage, smoke and explode.
- **HUD** — wanted stars, cash, health, ammo, speed, mission objective
  with a beacon, dialogue, circular minimap and a full-screen map.
- **Sound** — fully synthesized WebAudio: engine hum that follows your
  speed, gunshots, two-tone sirens, pickups and a mission-music loop. No
  audio files.
- **Save** — progress (cash, health, ammo, missions) autosaves to
  localStorage when a mission completes and when you pause; continue from
  the title screen.

## The story — 9 missions

You are a driver new to Vista Bay. **Mara Voss** gives you work,
**Dario Kane** is the fixer in the middle, and **Rook** wants the Bay for
himself.

1. **First Wheels** — steal your first car and bring it to Mara's garage.
2. **Pier Run** — a 90-second delivery to the end of the pier.
3. **Park Pickup** — meet a contact in Palm Park, then lose the cops.
4. **Pier Shootout** — take the pier back from four of Rook's gunmen.
5. **Cash Run** — collect five stashes hidden around the city.
6. **Casino Vault** — stop the Golden Palm vault truck and grab its cash.
7. **Port Clearance** — clear five gunmen from the docks.
8. **Convoy Ambush** — wreck two armored trucks.
9. **Runway Reckoning** — face Rook and his guards at the airport.

Each mission has its own dialogue, timer where the story needs one, beacon
and cash reward. Finish all nine and the city is yours.

## Screenshots

`screenshots/` holds four real in-browser renders: a police chase with a
3-star wanted level, the pier shootout, a walk through downtown, and the
title screen. They were captured with headless Chrome for Testing driving
the real game (`?shot=chase|mission|street|start` stages each scene).

## Files

```
game/
  index.html            page, HUD and menus
  vendor/three.min.js   Three.js r160 (vendored, dual-source verified)
  src/
    state.js            shared state, save/load, wanted & economy
    city.js             procedural city, roads, landmarks, colliders
    vehicles.js         traffic AI, parked cars, driving physics
    pedestrians.js      walkers who flee gunfire
    player.js           on-foot movement and the follow camera
    police.js           wanted heat, chases, arrests, roadblocks
    missions.js         the 9 story missions
    combat.js           shooting, melee, enemies, destructible cars
    hud.js              HUD, minimap and big map
    audio.js            synthesized WebAudio sound
    shots.js            ?shot= screenshot scene presets
    main.js             boot, input, screens, game loop
main.ts                 hand-in program: copies game/ + screenshots/,
                        writes dossier.json
serve.ts                tiny static server for local play
```

## License

MIT — see `LICENSE`.
