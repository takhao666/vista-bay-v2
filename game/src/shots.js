// Vista Bay — screenshot scenes behind ?shot=start|chase|mission|street.
// Each stages the real game (same world, same systems) into a readable
// frame: a chase with wanted stars, a shootout, a street scene, the menu.
import { setWanted } from './state.js';
import { startMission } from './missions.js';
import { spawnEnemy } from './combat.js';
import { spawnPoliceCarAt } from './police.js';

function putPlayerInCar(G, V, x, z) {
  // find the parked car nearest (x,z) and seat the player in it
  let best = null, bestD = Infinity;
  for (const car of V.parked) {
    if (car.stolen || car.destroyed) continue;
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return;
  best.stolen = true;
  G.player.inCar = true;
  G.player.car = best;
  G.player.x = best.x; G.player.z = best.z;
  G.carsStolen += 1;
}

export function stageShot(name, ctx) {
  const { G, V, P, C, M, scene } = ctx;
  G.screen = 'play';
  if (name === 'start') {
    G.screen = 'title';
    G.player.x = 0; G.player.z = 40;
    G.camera.yaw = 0.6;
    startMission(M, G, ctx, 0);
    return 'title';
  }
  if (name === 'chase') {
    putPlayerInCar(G, V, 0, 0);
    if (G.player.car) { G.player.car.x = 0; G.player.car.z = 0; G.player.car.angle = 0; }
    setWanted(G, 3);
    // two patrol cars in frame, holding a roadblock ahead with lights
    // flashing (held cars flash by design, and they cannot pile onto the
    // player's car while the screenshot settles)
    const block1 = spawnPoliceCarAt(ctx.POL, 16, 22, Math.PI);
    block1.hold = true; block1.holdTimer = 99;
    const block2 = spawnPoliceCarAt(ctx.POL, -18, 14, Math.PI * 0.9);
    block2.hold = true; block2.holdTimer = 99;
    G.missionIndex = 1;
    startMission(M, G, ctx, 1);
    G.missionMsg = 'Dario: "Ninety seconds to the pier — and the whole Bay PD is on you!"';
    return 'play';
  }
  if (name === 'mission') {
    G.player.x = 320; G.player.z = 0;
    G.player.angle = Math.PI / 2;
    G.camera.yaw = Math.PI / 2 + Math.PI;
    G.missionIndex = 3;
    startMission(M, G, ctx, 3);
    setWanted(G, 2);
    G.ammo = 48;
    return 'play';
  }
  // street (default): on foot downtown, traffic and pedestrians around
  G.player.x = 0; G.player.z = 30;
  G.player.angle = Math.PI;
  G.camera.yaw = 0;
  G.missionIndex = 0;
  startMission(M, G, ctx, 0);
  return 'play';
}
