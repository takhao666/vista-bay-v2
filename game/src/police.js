// Vista Bay — police: wanted heat, patrol cars that chase and ram, foot
// cops who arrest, roadblock cars that hold position, hiding to cool off,
// and busted / wasted respawn at the hospital (20% cash lost).
const THREE = window.THREE;
import { loseCashPenalty } from './state.js';
import { makeCarMesh } from './vehicles.js';
import { LANDMARKS as LM } from './city.js';

const SIREN_COLORS = [0xff2222, 0x2244ff];

export function createPolice(scene) {
  const group = new THREE.Group();
  group.name = 'police';
  scene.add(group);
  return { cars: [], cops: [], group, sirenPhase: 0 };
}

// A police car mesh: black-and-white body + light bar (flashes outside the
// hold branch below, so held roadblock cars flash too).
export function makePoliceCarMesh() {
  const mesh = makeCarMesh(0xf2f2f2);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.5),
    new THREE.MeshLambertMaterial({ color: 0xaa0000, emissive: 0x880000 }));
  bar.position.set(0, 1.55, -0.2);
  mesh.add(bar);
  mesh.userData.lightBar = bar;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.25, 4.42),
    new THREE.MeshLambertMaterial({ color: 0x111111 }));
  stripe.position.y = 0.55; mesh.add(stripe);
  return mesh;
}

export function spawnPoliceCarAt(P, x, z, angle = 0) {
  const car = spawnPoliceCar(P, null, x, z);
  car.angle = angle;
  car.mesh.rotation.y = angle;
  return car;
}

function spawnPoliceCar(P, G, x, z) {
  const mesh = makePoliceCarMesh();
  mesh.position.set(x, 0, z);
  P.group.add(mesh);
  const car = { mesh, x, z, angle: 0, speed: 0, hold: false, holdTimer: 0, siren: Math.random() * 10 };
  P.cars.push(car);
  return car;
}

function spawnCop(P, G, x, z) {
  const mesh = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.85, 0.32), mat);
  body.position.y = 1.2; mesh.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xd9a066 }));
  head.position.y = 1.85; mesh.add(head);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.12, 10),
    new THREE.MeshLambertMaterial({ color: 0x111111 }));
  hat.position.y = 2.02; mesh.add(hat);
  mesh.position.set(x, 0, z);
  P.group.add(mesh);
  const cop = { mesh, x, z, angle: 0, arrestTimer: 0 };
  P.cops.push(cop);
  return cop;
}

function spawnNearPlayer(P, G, kind) {
  const p = G.player;
  const px = p.inCar && p.car ? p.car.x : p.x;
  const pz = p.inCar && p.car ? p.car.z : p.z;
  const a = Math.random() * Math.PI * 2;
  const d = 55 + Math.random() * 35;
  const x = Math.max(-290, Math.min(290, px + Math.sin(a) * d));
  const z = Math.max(-290, Math.min(290, pz + Math.sin(a + 1) * d));
  return kind === 'car' ? spawnPoliceCar(P, G, x, z) : spawnCop(P, G, x, z);
}

export function updatePolice(P, G, dt, onBusted, onWasted) {
  const p = G.player;
  const px = p.inCar && p.car ? p.car.x : p.x;
  const pz = p.inCar && p.car ? p.car.z : p.z;
  P.sirenPhase += dt;

  // --- wanted level drives how many units exist ---
  const wantCars = G.wanted === 0 ? 0 : Math.min(2 + G.wanted, 6);
  const wantCops = G.wanted === 0 ? 0 : (p.inCar ? 0 : Math.min(G.wanted, 4));
  while (P.cars.length < wantCars) spawnNearPlayer(P, G, 'car');
  while (P.cops.length < wantCops) spawnNearPlayer(P, G, 'cop');
  // trim extras when wanted falls
  while (P.cars.length > wantCars) { const c = P.cars.pop(); P.group.remove(c.mesh); }
  while (P.cops.length > wantCops) { const c = P.cops.pop(); P.group.remove(c.mesh); }

  let nearestCop = Infinity;
  for (const car of P.cars) {
    const dx = px - car.x, dz = pz - car.z;
    const dist = Math.hypot(dx, dz);
    nearestCop = Math.min(nearestCop, dist);
    // At wanted 4+, one car holds a roadblock ahead of the player.
    if (G.wanted >= 4 && !car.hold && dist < 70 && Math.random() < dt * 0.05) {
      car.hold = true; car.holdTimer = 6;
      car.x = px + Math.sin(p.inCar && p.car ? p.car.angle : p.angle) * 28;
      car.z = pz + Math.cos(p.inCar && p.car ? p.car.angle : p.angle) * 28;
      car.angle = Math.atan2(px - car.x, pz - car.z);
    }
    if (car.hold) {
      car.holdTimer -= dt;
      if (car.holdTimer <= 0) car.hold = false;
      // hold cars sit still — but their light bars still flash (see below)
    } else {
      // chase: steer toward the player, ram at close range
      const want = Math.atan2(dx, dz);
      let diff = want - car.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      car.angle += Math.max(-3 * dt, Math.min(3 * dt, diff));
      const targetSpeed = 13 + G.wanted * 1.6;
      car.speed += (targetSpeed - car.speed) * Math.min(1, dt);
      car.x += Math.sin(car.angle) * car.speed * dt;
      car.z += Math.cos(car.angle) * car.speed * dt;
      // ramming the player's car damages it; ramming the player hurts them
      if (dist < 3.2) {
        if (p.inCar && p.car) {
          p.car.speed *= 0.55; p.car.health -= 6 * dt * 10;
          car.speed *= 0.6;
          if (p.car.health <= 0) { p.car.destroyed = true; }
        } else {
          G.health -= 18 * dt;
          if (G.health <= 0) onWasted();
        }
      }
    }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.angle;
    // light bar flashes for every police car, held or chasing
    const phase = Math.floor(P.sirenPhase * 6 + car.siren) % 2;
    car.mesh.userData.lightBar.material.color.setHex(SIREN_COLORS[phase]);
    car.mesh.userData.lightBar.material.emissive.setHex(SIREN_COLORS[phase]);
  }

  for (const cop of P.cops) {
    const dx = px - cop.x, dz = pz - cop.z;
    const dist = Math.hypot(dx, dz);
    nearestCop = Math.min(nearestCop, dist);
    const want = Math.atan2(dx, dz);
    let diff = want - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cop.angle += Math.max(-4 * dt, Math.min(4 * dt, diff));
    const v = dist > 2 ? 5.2 : 0;
    cop.x += Math.sin(cop.angle) * v * dt;
    cop.z += Math.cos(cop.angle) * v * dt;
    cop.mesh.position.set(cop.x, 0, cop.z);
    cop.mesh.rotation.y = cop.angle;
    if (dist < 2.2 && !p.inCar) {
      cop.arrestTimer += dt;
      if (cop.arrestTimer > 2) { onBusted(); cop.arrestTimer = 0; }
    } else cop.arrestTimer = 0;
  }

  // --- heat decay: no cop near for a while, wanted cools down ---
  if (G.wanted > 0) {
    if (nearestCop > 60) {
      G.hiddenTimer += dt;
      if (G.hiddenTimer > 8) { G.wanted -= 1; G.hiddenTimer = 0; }
    } else G.hiddenTimer = 0;
  }
}

// Busted / wasted: lose 20% cash, respawn at the hospital on foot, healthy.
export function respawnAtHospital(G) {
  const lost = loseCashPenalty(G);
  G.wanted = 0;
  G.health = 100;
  G.player.inCar = false;
  G.player.car = null;
  G.player.x = LM.hospital.x + 25;
  G.player.z = LM.hospital.z + 25;
  G.player.speed = 0;
  G.deaths += 1;
  return lost;
}
