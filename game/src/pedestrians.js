// Vista Bay — pedestrians: 42 walkers on the sidewalks. A gunshot nearby
// makes them flee; otherwise they stroll between random street corners.
const THREE = window.THREE;
import { STREETS, collideBuildings, clampWorld } from './city.js';

const PED_COUNT = 42;
const SHIRT_COLORS = [0xd23b2e, 0x2e6fd2, 0xf2c230, 0x3a9e4d, 0x8a4fd2, 0xeeeeee, 0xd27a2e, 0x2ea8a0];

export function makePedMesh(color) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2c3a4a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.8, 0.3), shirt);
  body.position.y = 1.15; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), skin);
  head.position.y = 1.75; g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.75, 0.22), pants);
  legL.position.set(-0.14, 0.38, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.14; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.65, 0.16), shirt);
  armL.position.set(-0.36, 1.15, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.36; g.add(armR);
  g.userData.legL = legL; g.userData.legR = legR;
  return g;
}

export function createPedestrians(scene, seed = 23) {
  let s = seed >>> 0;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const peds = [];
  const group = new THREE.Group();
  group.name = 'pedestrians';
  for (let i = 0; i < PED_COUNT; i++) {
    const mesh = makePedMesh(SHIRT_COLORS[Math.floor(rand() * SHIRT_COLORS.length)]);
    const x = -240 + rand() * 480, z = -240 + rand() * 480;
    mesh.position.set(x, 0, z);
    group.add(mesh);
    peds.push({
      mesh, x, z, angle: rand() * Math.PI * 2,
      speed: 1.2 + rand() * 0.8,
      tx: STREETS[Math.floor(rand() * STREETS.length)],
      tz: STREETS[Math.floor(rand() * STREETS.length)],
      fleeing: false, fleeTimer: 0, walkPhase: rand() * 6,
    });
  }
  scene.add(group);
  return { peds, group };
}

// A gunshot at (x,z) scares every pedestrian within 45 m.
export function scarePedestrians(P, x, z, radius = 45) {
  for (const p of P.peds) {
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < radius) {
      p.fleeing = true; p.fleeTimer = 3 + Math.random() * 2;
      // run away from the shot
      const a = Math.atan2(p.x - x, p.z - z);
      p.tx = p.x + Math.sin(a) * 80; p.tz = p.z + Math.cos(a) * 80;
    }
  }
}

export function updatePedestrians(P, dt, colliders) {
  for (const p of P.peds) {
    if (p.fleeTimer > 0) p.fleeTimer -= dt;
    if (p.fleeTimer <= 0) p.fleeing = false;
    const dx = p.tx - p.x, dz = p.tz - p.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 2) {
      p.tx = STREETS[Math.floor(Math.random() * STREETS.length)] + (Math.random() - 0.5) * 6;
      p.tz = STREETS[Math.floor(Math.random() * STREETS.length)] + (Math.random() - 0.5) * 6;
      continue;
    }
    const want = Math.atan2(dx, dz);
    let diff = want - p.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    p.angle += Math.max(-3 * dt, Math.min(3 * dt, diff));
    const v = p.speed * (p.fleeing ? 3.2 : 1);
    p.x += Math.sin(p.angle) * v * dt;
    p.z += Math.cos(p.angle) * v * dt;
    const pos = collideBuildings(colliders, p.x, p.z, 0.6);
    p.x = pos.x; p.z = pos.z;
    const c = clampWorld(p.x, p.z);
    p.x = c.x; p.z = c.z;
    p.mesh.position.set(p.x, 0, p.z);
    p.mesh.rotation.y = p.angle;
    // simple walk swing
    p.walkPhase += dt * (p.fleeing ? 14 : 7);
    const sw = Math.sin(p.walkPhase) * 0.35;
    p.mesh.userData.legL.rotation.x = sw;
    p.mesh.userData.legR.rotation.x = -sw;
  }
}
