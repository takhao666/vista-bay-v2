// Vista Bay — 9 story missions. Original characters: Mara Voss (the driver
// you work for), Dario Kane (the fixer in the middle), and Rook (the rival
// who wants the Bay for himself). Each mission has dialogue, a beacon,
// a timer where the story needs one, and a cash reward.
const THREE = window.THREE;
import { LANDMARKS } from './city.js';
import { addWanted, setWanted, saveGame } from './state.js';
import { spawnEnemy, clearEnemies } from './combat.js';

export const MISSIONS = [
  {
    title: 'First Wheels', giver: 'Mara Voss',
    briefing: 'Mara: "Welcome to Vista Bay. No car, no crew, no respect. Steal a parked car — press E next to one — then bring it to my garage."',
    objective: 'Steal a car (E) and drive it to the garage beacon',
    reward: 500,
  },
  {
    title: 'Pier Run', giver: 'Dario Kane',
    briefing: 'Dario: "A package is waiting at the pier. Ninety seconds, no excuses. The tide waits for no one, kid."',
    objective: 'Drive to the end of the pier in 90 seconds',
    reward: 800, timeLimit: 90,
  },
  {
    title: 'Park Pickup', giver: 'Mara Voss',
    briefing: 'Mara: "Meet my contact in Palm Park. Cops will be watching — lose them before you come back. Stay out of sight and the heat fades."',
    objective: 'Reach the park, then lose the 2-star wanted level',
    reward: 1000,
  },
  {
    title: 'Pier Shootout', giver: 'Dario Kane',
    briefing: 'Dario: "Rook\'s boys took the pier. Take it back. Four of them, all armed. Watch your health — grab cover and make every shot count."',
    objective: 'Clear the pier: defeat 4 gunmen',
    reward: 1200,
  },
  {
    title: 'Cash Run', giver: 'Mara Voss',
    briefing: 'Mara: "Five stashes hidden around the city. Grab them all before Rook\'s crew does. Follow the green beacons."',
    objective: 'Collect 5 cash stashes around Vista Bay',
    reward: 1500,
  },
  {
    title: 'Casino Vault', giver: 'Dario Kane',
    briefing: 'Dario: "A vault truck leaves the Golden Palm at dusk. Stop it — shoot it or ram it — then grab the cash. The cops will not like this."',
    objective: 'Stop the vault truck and collect its cash',
    reward: 2000,
  },
  {
    title: 'Port Clearance', giver: 'Mara Voss',
    briefing: 'Mara: "Rook is landing men at the port. Clear the docks. Five gunmen between you and the Bay."',
    objective: 'Defeat 5 gunmen at the port',
    reward: 2500,
  },
  {
    title: 'Convoy Ambush', giver: 'Dario Kane',
    briefing: 'Dario: "Two armored trucks, one road, no escort you can\'t handle. Wreck them both and the Bay is ours to take."',
    objective: 'Destroy 2 armored trucks',
    reward: 3000,
  },
  {
    title: 'Runway Reckoning', giver: 'Rook',
    briefing: 'Rook: "So the stray dog made it to my runway. My guards, then me. Come and take the Bay — if you can."',
    objective: 'Defeat Rook and his 6 guards at the airport',
    reward: 5000,
  },
];

const CASH_SPOTS = [
  { x: 200, z: 200 }, { x: -200, z: -120 }, { x: 60, z: -240 },
  { x: -240, z: 60 }, { x: 120, z: 240 },
];

export function createMissions(scene) {
  const group = new THREE.Group();
  group.name = 'missions';
  scene.add(group);
  // beacon: tall pulsing yellow column
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(2.2, 2.2, 30, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23b, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  beacon.position.y = 15;
  group.add(beacon);
  const marker = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.4, 20),
    new THREE.MeshBasicMaterial({ color: 0xffd23b, transparent: true, opacity: 0.7 }));
  marker.position.y = 0.2;
  group.add(marker);
  return {
    group, beacon, marker, beaconPos: { x: 0, z: 60 },
    cashMeshes: [], cashLeft: 0, killsAtStart: 0,
    timer: 0, stage: 0, vaultTruck: null, convoy: [],
    active: false, message: '',
  };
}

function setBeacon(M, x, z) {
  M.beaconPos = { x, z };
  M.beacon.position.set(x, 15, z);
  M.marker.position.set(x, 0.2, z);
}

function spawnCash(M, spots) {
  clearCash(M);
  M.cashLeft = spots.length;
  for (const s of spots) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.8, 1.2),
      new THREE.MeshLambertMaterial({ color: 0x2ecc40, emissive: 0x0a5518 }));
    mesh.position.set(s.x, 0.6, s.z);
    M.group.add(mesh);
    M.cashMeshes.push({ mesh, x: s.x, z: s.z, taken: false });
  }
}

function clearCash(M) {
  for (const c of M.cashMeshes) M.group.remove(c.mesh);
  M.cashMeshes = [];
}

function spawnMissionTruck(M, V, scene, x, z, angle, health, label) {
  // Built from the same car factory as every other vehicle.
  const mesh = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 5.2),
    new THREE.MeshLambertMaterial({ color: label === 'vault' ? 0x8a8a8a : 0x3a3a3a }));
  body.position.y = 1.1; mesh.add(body);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1, 1.6),
    new THREE.MeshLambertMaterial({ color: 0x1a2530 }));
  cab.position.set(0, 2.3, 1.4); mesh.add(cab);
  const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [wx, wz] of [[-1.15, 1.6], [1.15, 1.6], [-1.15, -1.6], [1.15, -1.6]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(wx, 0.45, wz); mesh.add(w);
  }
  mesh.position.set(x, 0, z);
  mesh.rotation.y = angle;
  M.group.add(mesh);
  const truck = {
    kind: 'mission', mesh, x, z, angle, speed: 0, health,
    destroyed: false, stolen: false, label,
  };
  V.parked.push(truck); // raycast targets include parked cars, so it can be shot
  return truck;
}

export function startMission(M, G, ctx, index) {
  const def = MISSIONS[index];
  M.active = true;
  M.stage = 0;
  M.timer = def.timeLimit || 0;
  M.killsAtStart = G.kills;
  clearEnemies(ctx.C);
  clearCash(M);
  M.vaultTruck = null;
  M.convoy = [];
  G.missionStage = 0;
  G.missionTimer = M.timer;
  G.missionMsg = def.briefing;
  const L = LANDMARKS;
  switch (index) {
    case 0: setBeacon(M, L.garage.x, L.garage.z); break;
    case 1: setBeacon(M, L.pierEnd.x, L.pierEnd.z); break;
    case 2: setBeacon(M, L.park.x, L.park.z); break;
    case 3:
      setBeacon(M, L.pier.x, L.pier.z);
      for (let i = 0; i < 4; i++) spawnEnemy(ctx.C, 335 + i * 10, -4 + (i % 2) * 8);
      break;
    case 4: spawnCash(M, CASH_SPOTS); setBeacon(M, CASH_SPOTS[0].x, CASH_SPOTS[0].z); break;
    case 5:
      M.vaultTruck = spawnMissionTruck(M, ctx.V, ctx.scene, 180, -120, Math.PI, 120, 'vault');
      setBeacon(M, 180, -120);
      break;
    case 6:
      setBeacon(M, L.port.x, L.port.z);
      for (let i = 0; i < 5; i++) spawnEnemy(ctx.C, -272 + (i % 2) * 10, -60 + i * 12);
      break;
    case 7:
      M.convoy.push(spawnMissionTruck(M, ctx.V, ctx.scene, 0, -180, 0, 150, 'armored'));
      M.convoy.push(spawnMissionTruck(M, ctx.V, ctx.scene, 0, -150, 0, 150, 'armored'));
      setBeacon(M, 0, -165);
      break;
    case 8:
      setBeacon(M, L.runway.x, L.runway.z);
      for (let i = 0; i < 6; i++) spawnEnemy(ctx.C, -220 + (i % 3) * 15, -265 + Math.floor(i / 3) * 12);
      spawnEnemy(ctx.C, -200, -250, { boss: true, name: 'Rook' });
      break;
  }
  return def;
}

function playerPos(G) {
  const p = G.player;
  return p.inCar && p.car ? { x: p.car.x, z: p.car.z } : { x: p.x, z: p.z };
}

function near(a, b, r) { return Math.hypot(a.x - b.x, a.z - b.z) < r; }

// Returns 'complete' | 'failed' | 'active'. Completing pays the reward and saves.
export function updateMissions(M, G, ctx, dt) {
  if (!M.active || G.missionIndex >= MISSIONS.length) return 'active';
  const i = G.missionIndex;
  const def = MISSIONS[i];
  const pos = playerPos(G);
  // cash pickups work in any mission that spawned them (Cash Run, Casino Vault)
  for (const c of M.cashMeshes) {
    if (!c.taken && near(pos, c, 3)) {
      c.taken = true; c.mesh.visible = false; M.cashLeft -= 1;
      G.cash += 100;
      G.missionMsg = `Cash stash grabbed! ${M.cashLeft} left.`;
      if (M.cashLeft > 0) {
        const next = M.cashMeshes.find(m => !m.taken);
        if (next) setBeacon(M, next.x, next.z);
      }
    }
  }
  M.beacon.rotation.y += dt;
  M.beacon.material.opacity = 0.25 + Math.sin(G.time * 4) * 0.12;

  if (M.timer > 0) {
    M.timer -= dt;
    G.missionTimer = M.timer;
    if (M.timer <= 0) {
      G.missionMsg = 'Too slow — the job fell through. Try again from the beacon.';
      M.active = false;
      return 'failed';
    }
  }

  // live kill progress for the shootout / clearance / finale missions
  const killsSoFar = G.kills - M.killsAtStart;
  const killTargets = { 3: 4, 6: 5, 8: 7 };
  if (killTargets[i] !== undefined) {
    const left = Math.max(0, killTargets[i] - killsSoFar);
    G.missionExtra = left > 0 ? ` (${left} left)` : '';
  } else G.missionExtra = '';

  let done = false;
  switch (i) {
    case 0:
      done = G.player.inCar && near(pos, LANDMARKS.garage, 8);
      break;
    case 1:
      done = near(pos, LANDMARKS.pierEnd, 8);
      break;
    case 2:
      if (M.stage === 0 && near(pos, LANDMARKS.park, 8)) {
        M.stage = 1; G.missionStage = 1;
        setWanted(G, 2);
        G.missionMsg = 'Contact met. Cops are on you — lose the wanted level!';
        setBeacon(M, LANDMARKS.downtown.x, LANDMARKS.downtown.z);
      } else if (M.stage === 1 && G.wanted === 0) done = true;
      break;
    case 3:
      done = G.kills - M.killsAtStart >= 4;
      break;
    case 4: {
      done = M.cashLeft === 0;
      break;
    }
    case 5: {
      const t = M.vaultTruck;
      if (t && !t.destroyed) {
        // the vault truck creeps away from the casino along the street
        t.z += 3 * dt; t.mesh.position.set(t.x, 0, t.z);
        setBeacon(M, t.x, t.z);
      }
      if (t && t.destroyed && M.stage === 0) {
        M.stage = 1; G.missionStage = 1;
        spawnCash(M, [{ x: t.x, z: t.z }]);
        G.missionMsg = 'Truck stopped! Grab the vault cash.';
      }
      done = M.stage === 1 && M.cashLeft === 0;
      break;
    }
    case 6:
      done = G.kills - M.killsAtStart >= 5;
      break;
    case 7:
      done = M.convoy.length > 0 && M.convoy.every(t => t.destroyed);
      break;
    case 8: {
      const rook = ctx.C.enemies.find(e => e.boss);
      const guardsDown = ctx.C.enemies.filter(e => !e.boss && !e.alive).length;
      done = rook && !rook.alive && guardsDown >= 6;
      break;
    }
  }

  if (done) {
    M.active = false;
    clearEnemies(ctx.C);
    clearCash(M);
    G.cash += def.reward;
    G.missionDone[i] = true;
    G.missionIndex += 1;
    G.stats.missionsCompleted += 1;
    G.missionMsg = `MISSION COMPLETE: ${def.title} — +$${def.reward}`;
    saveGame(G);
    if (G.missionIndex >= MISSIONS.length) {
      G.screen = 'win';
      G.missionMsg = 'You own Vista Bay. Rook is finished — the city is yours.';
    } else {
      const next = MISSIONS[G.missionIndex];
      setTimeout(() => { if (G.screen === 'play') startMission(M, G, ctx, G.missionIndex); }, 2500);
      G.missionMsg += ` | Next: ${next.title} — ${next.giver}`;
    }
    return 'complete';
  }
  return 'active';
}

export function missionObjective(G) {
  if (G.missionIndex >= MISSIONS.length) return 'Vista Bay is yours.';
  const def = MISSIONS[G.missionIndex];
  return `${G.missionIndex + 1}/9 ${def.title}: ${def.objective}${G.missionExtra || ''}`;
}
