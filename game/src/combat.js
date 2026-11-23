// Vista Bay — combat: pistol raycast shooting with tracers, melee punches,
// armed enemies who shoot back, and destructible cars that smoke and blow up.
const THREE = window.THREE;
import { scarePedestrians } from './pedestrians.js';
import { addWanted } from './state.js';

export function createCombat(scene) {
  const group = new THREE.Group();
  group.name = 'combat';
  scene.add(group);
  return { group, enemies: [], tracers: [], explosions: [], fireCooldown: 0, meleeCooldown: 0 };
}

export function spawnEnemy(C, x, z, opts = {}) {
  const g = new THREE.Group();
  const color = opts.boss ? 0x111111 : 0x7a1f1f;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.85, 0.32),
    new THREE.MeshLambertMaterial({ color }));
  body.position.y = 1.2; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xd9a066 }));
  head.position.y = 1.85; g.add(head);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.55),
    new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.3, 1.35, 0.3); g.add(gun);
  g.position.set(x, 0, z);
  C.group.add(g);
  const e = {
    mesh: g, x, z, angle: 0, health: opts.boss ? 220 : 60,
    shootTimer: 1 + Math.random(), boss: !!opts.boss, name: opts.name || 'Gunman',
    alive: true,
  };
  C.enemies.push(e);
  return e;
}

function addTracer(C, from, to, color = 0xffe27a) {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(from.x, from.y, from.z),
    new THREE.Vector3(to.x, to.y, to.z),
  ]);
  const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color }));
  line.userData.life = 0.12;
  C.group.add(line);
  C.tracers.push(line);
}

function explode(C, G, x, z) {
  const flash = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 10),
    new THREE.MeshBasicMaterial({ color: 0xffa030, transparent: true, opacity: 0.9 }));
  flash.position.set(x, 1.5, z);
  flash.userData.life = 0.5;
  C.group.add(flash);
  C.explosions.push(flash);
  // blast hurts nearby enemies and the player if close
  for (const e of C.enemies) {
    if (e.alive && Math.hypot(e.x - x, e.z - z) < 8) damageEnemy(C, G, e, 80);
  }
  const p = G.player;
  const px = p.inCar && p.car ? p.car.x : p.x;
  const pz = p.inCar && p.car ? p.car.z : p.z;
  if (Math.hypot(px - x, pz - z) < 7) G.health -= 30;
}

export function damageEnemy(C, G, e, dmg) {
  if (!e.alive) return;
  e.health -= dmg;
  if (e.health <= 0) {
    e.alive = false;
    e.mesh.visible = false;
    G.kills += 1;
  }
}

// Damage a car; at 0 health it explodes and becomes a wreck.
export function damageCar(C, G, car, dmg) {
  if (car.destroyed) return;
  car.health -= dmg;
  if (car.health <= 0) {
    car.destroyed = true;
    explode(C, G, car.x, car.z);
    car.mesh.rotation.z = 0.4; // wreck tilt
    if (G.player.car === car) { G.player.inCar = false; G.player.car = null; }
  }
}

// Player fires the pistol toward a world point (from the camera ray).
// Returns 'hit-enemy' | 'hit-car' | 'miss' | 'empty' | 'cooldown'.
export function playerShoot(C, G, V, P, origin, dir) {
  if (C.fireCooldown > 0) return 'cooldown';
  if (G.ammo <= 0) return 'empty';
  C.fireCooldown = 0.28;
  G.ammo -= 1;
  G.shotsFired += 1;
  const ray = new THREE.Raycaster(origin, dir, 0, 120);
  const targets = [];
  for (const e of C.enemies) if (e.alive) targets.push({ obj: e.mesh, kind: 'enemy', ref: e });
  for (const car of [...V.traffic, ...V.parked]) {
    if (!car.destroyed) targets.push({ obj: car.mesh, kind: 'car', ref: car });
  }
  const meshes = targets.map(t => t.obj);
  const hits = ray.intersectObjects(meshes, true);
  const end = origin.clone().add(dir.clone().multiplyScalar(90));
  let result = 'miss';
  if (hits.length > 0) {
    const hit = hits[0];
    end.copy(hit.point);
    // walk up to the group that owns this mesh
    let node = hit.object, owner = null;
    while (node) {
      const found = targets.find(t => t.obj === node);
      if (found) { owner = found; break; }
      node = node.parent;
    }
    if (owner) {
      if (owner.kind === 'enemy') { damageEnemy(C, G, owner.ref, 34); result = 'hit-enemy'; }
      else { damageCar(C, G, owner.ref, 20); result = 'hit-car'; }
    }
  }
  addTracer(C, origin, end);
  scarePedestrians(P, origin.x, origin.z, 45);
  if (result !== 'miss') addWanted(G, 0); // shooting in public draws attention via missions/police
  return result;
}

// Melee punch: hurts the nearest enemy within 2.2 m in front.
export function playerPunch(C, G) {
  if (C.meleeCooldown > 0) return false;
  C.meleeCooldown = 0.5;
  const p = G.player;
  for (const e of C.enemies) {
    if (!e.alive) continue;
    const d = Math.hypot(e.x - p.x, e.z - p.z);
    if (d < 2.4) { damageEnemy(C, G, e, 25); return true; }
  }
  return false;
}

// Enemies advance on the player and shoot back with poor aim.
export function updateEnemies(C, G, dt, onPlayerDown) {
  C.fireCooldown = Math.max(0, C.fireCooldown - dt);
  C.meleeCooldown = Math.max(0, C.meleeCooldown - dt);
  const p = G.player;
  const px = p.inCar && p.car ? p.car.x : p.x;
  const pz = p.inCar && p.car ? p.car.z : p.z;
  for (const e of C.enemies) {
    if (!e.alive) continue;
    const dx = px - e.x, dz = pz - e.z;
    const dist = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz);
    e.angle = want;
    e.mesh.rotation.y = want;
    if (dist > 14) {
      e.x += Math.sin(want) * 4.5 * dt;
      e.z += Math.cos(want) * 4.5 * dt;
    } else if (dist < 6) {
      e.x -= Math.sin(want) * 1.5 * dt;
      e.z -= Math.cos(want) * 1.5 * dt;
    }
    e.mesh.position.set(e.x, 0, e.z);
    e.shootTimer -= dt;
    if (e.shootTimer <= 0 && dist < 55) {
      e.shootTimer = 1.1 + Math.random() * 0.9;
      const from = new THREE.Vector3(e.x, 1.4, e.z);
      // poor aim: only ~35% of shots land
      if (Math.random() < 0.35) {
        G.health -= e.boss ? 12 : 7;
        addTracer(C, from, new THREE.Vector3(px, 1.2, pz), 0xff5544);
        if (G.health <= 0) onPlayerDown();
      } else {
        const miss = new THREE.Vector3(px + (Math.random() - 0.5) * 6, 1, pz + (Math.random() - 0.5) * 6);
        addTracer(C, from, miss, 0xff5544);
      }
    }
  }
  // fade tracers and explosion flashes
  for (let i = C.tracers.length - 1; i >= 0; i--) {
    const t = C.tracers[i];
    t.userData.life -= dt;
    if (t.userData.life <= 0) { C.group.remove(t); C.tracers.splice(i, 1); }
  }
  for (let i = C.explosions.length - 1; i >= 0; i--) {
    const f = C.explosions[i];
    f.userData.life -= dt;
    f.scale.multiplyScalar(1 + dt * 3);
    f.material.opacity = Math.max(0, f.userData.life * 1.8);
    if (f.userData.life <= 0) { C.group.remove(f); C.explosions.splice(i, 1); }
  }
}

export function clearEnemies(C) {
  for (const e of C.enemies) C.group.remove(e.mesh);
  C.enemies = [];
}
