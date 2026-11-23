// Vista Bay — the hand-in program for the make.fun gta6-01 competition.
// The game itself is plain static files under game/ (game/index.html plus its
// ES modules, with Three.js r160 vendored as game/vendor/three.min.js). A
// desktop browser opens it offline: every script, image and font the page
// loads is a file inside game/ or a data: URI, so there is no network
// request at all. This program, main.ts, is the only build step: it copies
// game/ and screenshots/ from beside this file into the output directory
// and writes /output/dossier.json with the kit's vendored library
// (vendor/makefun-game.ts), which the judge reads.
//
// Run it locally with:
//   MAKEFUN_OUTPUT_DIR=out node main.ts
// and serve the game itself with:
//   node serve.ts            # http://localhost:8080
//
// Node 22, standard library only. The program runs twice in grading and
// both runs must write the same bytes, so it does no timestamps, no random
// choices and no network calls of its own.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fresh output: game/ first, then the screenshots beside it.
mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps (reference/gate.json): text_max_bytes shapes the
// dossier text; the other caps refuse an entry the scorer would refuse —
// more than 4 screenshots or one over 256 KiB; more than 993 files in game/
// or 48 MiB of game files in all, or a path under game/ over 1000 bytes.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
