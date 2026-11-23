// Vista Bay — vehicles: 26 traffic cars on the road graph, 18 parked cars
// that can be stolen, car meshes, and arcade driving physics.
// Traffic cars are never given to the player; parked cars are never driven
// by traffic AI (a stolen car stays the player's until it is abandoned).
const THREE = window.THREE;
import { STREETS, collideBuildings, clampWorld } from './city.js';

const CAR_COLORS = [0xd23b2e, 0x2e6fd2, 0xf2c230, 0xeeeeee, 0x222831, 0x3a9e4d, 0x8a4fd2, 0xd27a2e, 0x9ab0c0, 0x6b4a2f];
const TRAFFIC_COUNT = 26;
const PARKED_COUNT = 18;

export function makeCarMesh(color) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4.4), bodyMat);
  body.position.y = 0.55; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2),
    new THREE.MeshLambertMaterial({ color: 0x1a2530 }));
  cabin.position.set(0, 1.15, -0.2); g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  for (const [x, z] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2; w.position.set(x, 0.38, z); g.add(w);
  }
  // headlights
  const hl = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.1),
    new THREE.MeshLambertMaterial({ color: 0xfff6b0, emissive: 0x555533 }));
  hl.position.set(-0.6, 0.6, 2.22); g.add(hl);
  const hl2 = hl.clone(); hl2.position.x = 0.6; g.add(hl2);
  g.userData.wheels = [];
  return g;
}

function randomStreetNode(rand) {
  return { x: STREETS[Math.floor(rand() * STREETS.length)], z: STREETS[Math.floor(rand() * STREETS.length)] };
}

export function createVehicles(scene, colliders, seed = 11) {
  let s = seed >>> 0;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const traffic = [];
  const parked = [];
  const group = new THREE.Group();
  group.name = 'vehicles';

  for (let i = 0; i < TRAFFIC_COUNT; i++) {
    const node = randomStreetNode(rand);
    const mesh = makeCarMesh(CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)]);
    mesh.position.set(node.x, 0, node.z);
    group.add(mesh);
    const target = randomStreetNode(rand);
    traffic.push({
      kind: 'traffic', mesh, x: node.x, z: node.z,
      angle: 0, speed: 7 + rand() * 3, target, health: 100,
      stuck: 0, color: mesh.children[0].material.color.getHex(),
    });
  }
  // Parked cars along street edges, facing along the street.
  for (let i = 0; i < PARKED_COUNT; i++) {
    const street = STREETS[1 + Math.floor(rand() * (STREETS.length - 2))];
    const along = -230 + rand() * 460;
    const side = rand() < 0.5 ? 7 : -7;
    const horizontal = rand() < 0.5;
    const x = horizontal ? along : street + side;
    const z = horizontal ? street + side : along;
    const mesh = makeCarMesh(CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)]);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = horizontal ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
    group.add(mesh);
    parked.push({
      kind: 'parked', mesh, x, z, angle: mesh.rotation.y, speed: 0,
      health: 100, stolen: false, destroyed: false,
    });
  }
  scene.add(group);
  return { traffic, parked, group };
}

// Correct heading: angle = atan2(dx, dz) so the car nose (+Z local) faces motion.
function headingTo(tx, tz, x, z) { return Math.atan2(tx - x, tz - z); }

export function updateTraffic(V, dt, playerCar) {
  for (const car of V.traffic) {
    if (car.destroyed) continue;
    const dx = car.target.x - car.x, dz = car.target.z - car.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 4) {
      car.target = randomStreetNode(Math.random);
      continue;
    }
    const want = headingTo(car.target.x, car.target.z, car.x, car.z);
    // turn toward the target heading at a bounded rate
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += Math.max(-2.2 * dt, Math.min(2.2 * dt, diff));
    const v = car.speed * (Math.abs(diff) > 0.9 ? 0.4 : 1);
    car.x += Math.sin(car.angle) * v * dt;
    car.z += Math.cos(car.angle) * v * dt;
    const p = clampWorld(car.x, car.z);
    car.x = p.x; car.z = p.z;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.angle;
  }
}

// Arcade driving for the player's car. Returns speed in m/s.
export function driveCar(car, input, dt, colliders) {
  const accel = 22, brake = 34, maxSpeed = 38, reverseMax = 12;
  if (input.forward) car.speed += accel * dt;
  else if (input.back) car.speed -= brake * dt * 0.6;
  else car.speed *= Math.max(0, 1 - 0.8 * dt); // drag
  if (input.back && car.speed > 0.5) car.speed -= brake * dt; // brake
  car.speed = Math.max(-reverseMax, Math.min(maxSpeed, car.speed));
  const steer = (input.left ? 1 : 0) - (input.right ? 1 : 0);
  const dir = car.speed >= 0 ? 1 : -1;
  car.angle += steer * 1.9 * dt * dir * Math.min(1, Math.abs(car.speed) / 8 + 0.25);
  car.x += Math.sin(car.angle) * car.speed * dt;
  car.z += Math.cos(car.angle) * car.speed * dt;
  const p = collideBuildings(colliders, car.x, car.z, 2.2);
  if (p.x !== car.x || p.z !== car.z) { car.speed *= 0.4; car.x = p.x; car.z = p.z; }
  const c = clampWorld(car.x, car.z);
  if (c.x !== car.x || c.z !== car.z) { car.speed *= 0.3; car.x = c.x; car.z = c.z; }
  car.mesh.position.set(car.x, 0, car.z);
  car.mesh.rotation.y = car.angle;
  return car.speed;
}

// Nearest parked (stealable) car within range of a point.
export function nearestParked(V, x, z, range = 4) {
  let best = null, bestD = range;
  for (const car of V.parked) {
    if (car.stolen || car.destroyed) continue;
    const d = Math.hypot(car.x - x, car.z - z);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

export function allCars(V) { return [...V.traffic, ...V.parked]; }
