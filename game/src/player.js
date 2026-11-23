// Vista Bay — player: third-person on-foot movement and the follow camera.
// Mouse drag orbits; otherwise the camera trails behind the player/car.
const THREE = window.THREE;
import { collideBuildings, clampWorld } from './city.js';

export function makePlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x1f6fb2 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xd9a066 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x232323 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.85, 0.32), jacket);
  body.position.y = 1.2; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), skin);
  head.position.y = 1.85; g.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5),
    new THREE.MeshLambertMaterial({ color: 0xd23b2e }));
  cap.position.y = 2.02; g.add(cap);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.8, 0.24), pants);
  legL.position.set(-0.15, 0.4, 0); g.add(legL);
  const legR = legL.clone(); legR.position.x = 0.15; g.add(legR);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.7, 0.18), jacket);
  armL.position.set(-0.4, 1.2, 0); g.add(armL);
  const armR = armL.clone(); armR.position.x = 0.4; g.add(armR);
  g.userData = { legL, legR, armL, armR, walkPhase: 0 };
  return g;
}

// input: {forward,back,left,right,run} in camera-relative space.
export function updatePlayer(G, mesh, input, dt, colliders) {
  const p = G.player;
  if (p.inCar) { mesh.visible = false; return; }
  mesh.visible = true;
  const walkSpeed = input.run ? 8.5 : 4.6;
  // camera-relative move direction
  const yaw = G.camera.yaw;
  let mx = 0, mz = 0;
  if (input.forward) { mx += -Math.sin(yaw); mz += -Math.cos(yaw); }
  if (input.back) { mx += Math.sin(yaw); mz += Math.cos(yaw); }
  if (input.left) { mx += -Math.cos(yaw); mz += Math.sin(yaw); }
  if (input.right) { mx += Math.cos(yaw); mz += -Math.sin(yaw); }
  const len = Math.hypot(mx, mz);
  p.moving = len > 0;
  p.running = !!input.run && p.moving;
  if (len > 0) {
    mx /= len; mz /= len;
    const want = Math.atan2(mx, mz);
    let diff = want - p.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    p.angle += Math.max(-10 * dt, Math.min(10 * dt, diff));
    p.x += mx * walkSpeed * dt;
    p.z += mz * walkSpeed * dt;
  }
  const pos = collideBuildings(colliders, p.x, p.z, 0.6);
  p.x = pos.x; p.z = pos.z;
  const c = clampWorld(p.x, p.z);
  p.x = c.x; p.z = c.z;
  mesh.position.set(p.x, 0, p.z);
  mesh.rotation.y = p.angle;
  // walk swing
  const u = mesh.userData;
  if (p.moving) {
    u.walkPhase += dt * (p.running ? 13 : 8);
    const sw = Math.sin(u.walkPhase) * 0.5;
    u.legL.rotation.x = sw; u.legR.rotation.x = -sw;
    u.armL.rotation.x = -sw; u.armR.rotation.x = sw;
  } else {
    u.legL.rotation.x = 0; u.legR.rotation.x = 0;
    u.armL.rotation.x = 0; u.armR.rotation.x = 0;
  }
}

// Third-person camera: orbits with drag, otherwise trails behind heading.
export function updateCamera(G, camera, dt, dragging) {
  const p = G.player;
  const cam = G.camera;
  if (!dragging) {
    // ease yaw toward the player's heading (behind them)
    const targetYaw = p.inCar && p.car ? p.car.angle + Math.PI : p.angle + Math.PI;
    let diff = targetYaw - cam.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cam.yaw += diff * Math.min(1, 2.5 * dt);
  }
  const focus = p.inCar && p.car
    ? { x: p.car.x, z: p.car.z, y: 1.5 }
    : { x: p.x, z: p.z, y: 1.6 };
  const dist = p.inCar ? 12 : 9;
  const pitch = cam.pitch;
  const cx = focus.x + Math.sin(cam.yaw) * Math.cos(pitch) * dist;
  const cz = focus.z + Math.cos(cam.yaw) * Math.cos(pitch) * dist;
  const cy = focus.y + Math.sin(pitch) * dist;
  camera.position.set(cx, Math.max(1.2, cy), cz);
  camera.lookAt(focus.x, focus.y, focus.z);
}
