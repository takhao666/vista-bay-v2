// Vista Bay — boot, input, screens and the one game loop.
// Builds the world, wires every system together, and exposes window.__VB
// (a read-only state probe the automated playtests use) and window.__shotReady.
const THREE = window.THREE;
import { createState, saveGame, loadGame, hasSave, applySave, addWanted } from './state.js';
import { buildCity, LANDMARKS } from './city.js';
import { createVehicles, updateTraffic, driveCar, nearestParked } from './vehicles.js';
import { createPedestrians, updatePedestrians } from './pedestrians.js';
import { makePlayerMesh, updatePlayer, updateCamera } from './player.js';
import { createPolice, updatePolice, respawnAtHospital } from './police.js';
import { createCombat, playerShoot, playerPunch, updateEnemies, damageCar } from './combat.js';
import { createMissions, startMission, updateMissions, MISSIONS } from './missions.js';
import { createHud, updateHud, showMenu, toast } from './hud.js';
import { createAudio, initAudio, playGunshot, playPickup, playClick, playCrash, playMissionComplete, playBusted, updateAudio, startMusic } from './audio.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');

const G = createState();
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 1200);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('game'), antialias: false });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(1);

const city = buildCity(scene, 7);
const colliders = city.colliders;
const V = createVehicles(scene, colliders, 11);
const P = createPedestrians(scene, 23);
const POL = createPolice(scene);
const C = createCombat(scene);
const M = createMissions(scene);
const H = createHud();
const A = createAudio();

const playerMesh = makePlayerMesh();
scene.add(playerMesh);

// crosshair for shooting
const crosshair = document.getElementById('crosshair');

// --- input ---
const keys = {};
let dragging = false, dragMoved = false, lastX = 0, lastY = 0;
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyM' && !e.repeat) { G.bigMap = !G.bigMap; return; }
  keys[e.code] = true;
  if (e.code === 'Enter' || e.code === 'Space') {
    if (G.screen === 'title' || G.screen === 'over' || G.screen === 'win') startGame();
  }
  if ((e.code === 'KeyP' || e.code === 'Escape') && !e.repeat) togglePause();
  if (e.code === 'KeyE' && !e.repeat) tryEnterExitCar();
  if (e.code === 'KeyF' && !e.repeat) doPunch();
  if (e.code === 'KeyR' && !e.repeat) reload();
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
const canvas = document.getElementById('game');
canvas.addEventListener('pointerdown', (e) => {
  initAudio(A);
  dragging = true; dragMoved = false; lastX = e.clientX; lastY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const dx = e.clientX - lastX, dy = e.clientY - lastY;
  if (Math.abs(dx) + Math.abs(dy) > 4) dragMoved = true;
  lastX = e.clientX; lastY = e.clientY;
  G.camera.yaw -= dx * 0.005;
  G.camera.pitch = Math.max(0.05, Math.min(1.1, G.camera.pitch + dy * 0.003));
});
canvas.addEventListener('pointerup', (e) => {
  dragging = false;
  if (!dragMoved && G.screen === 'play' && !G.player.inCar) doShoot();
  else if (!dragMoved && G.screen === 'play' && G.player.inCar) doShootFromCar();
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function inputState() {
  return {
    forward: !!(keys.KeyW || keys.ArrowUp),
    back: !!(keys.KeyS || keys.ArrowDown),
    left: !!(keys.KeyA || keys.ArrowLeft),
    right: !!(keys.KeyD || keys.ArrowRight),
    run: !!keys.ShiftLeft || !!keys.ShiftRight,
  };
}

function tryEnterExitCar() {
  if (G.screen !== 'play') return;
  initAudio(A);
  const p = G.player;
  if (p.inCar) {
    const car = p.car;
    p.inCar = false; p.car = null;
    p.x = car.x + Math.cos(car.angle) * 3;
    p.z = car.z - Math.sin(car.angle) * 3;
    p.angle = car.angle;
    toast(H, 'You left the car.');
    return;
  }
  const car = nearestParked(V, p.x, p.z, 4.5);
  if (car) {
    car.stolen = true;
    p.inCar = true; p.car = car;
    G.carsStolen += 1;
    addWanted(G, 1);
    playCrash(A);
    toast(H, 'Car stolen! The cops saw that — wanted level up.');
    G.missionMsg = 'You stole a car! That is a crime in Vista Bay — lose the cops or lay low.';
  } else {
    toast(H, 'No car close enough. Walk up to a parked car and press E.');
  }
}

function doShoot() {
  if (G.screen !== 'play') return;
  initAudio(A);
  const ray = new THREE.Raycaster();
  ray.setFromCamera({ x: 0, y: 0 }, camera);
  const result = playerShoot(C, G, V, P, ray.ray.origin, ray.ray.direction);
  if (result === 'empty') { toast(H, 'Out of ammo — press R to reload.'); return; }
  if (result === 'cooldown') return;
  playGunshot(A);
  if (result === 'hit-enemy') toast(H, 'Hit!');
}

function doShootFromCar() { doShoot(); }

function doPunch() {
  if (G.screen !== 'play' || G.player.inCar) return;
  if (playerPunch(C, G)) { playGunshot(A); toast(H, 'Punch landed!'); }
}

function reload() {
  if (G.ammo >= 24 || G.reserveAmmo <= 0) return;
  const need = 24 - G.ammo;
  const take = Math.min(need, G.reserveAmmo);
  G.ammo += take; G.reserveAmmo -= take;
  toast(H, `Reloaded — ${G.ammo} rounds ready.`);
}

function onBusted() {
  const lost = respawnAtHospital(G);
  playBusted(A);
  G.missionMsg = `BUSTED! The Vista Bay PD caught you. -$${lost} and back at the hospital.`;
  toast(H, `Busted! Lost $${lost}.`);
  saveGame(G);
}

function onWasted() {
  if (G.screen !== 'play') return;
  const lost = respawnAtHospital(G);
  playBusted(A);
  G.missionMsg = `WASTED! You were taken down. -$${lost} and back at the hospital.`;
  toast(H, `Wasted! Lost $${lost}.`);
  saveGame(G);
}

function togglePause() {
  if (G.screen === 'play') {
    G.screen = 'paused'; G.paused = true;
    saveGame(G);
    showMenu(H, 'Paused', 'Take a breath. Your progress is saved.<br><br><button id="resume-btn">Resume</button> <button id="restart-btn">Restart day</button>', true);
    bindMenuButtons();
  } else if (G.screen === 'paused') {
    G.screen = 'play'; G.paused = false;
    showMenu(H, '', '', false);
  }
}

function bindMenuButtons() {
  const resume = document.getElementById('resume-btn');
  if (resume) resume.addEventListener('click', () => { playClick(A); togglePause(); });
  const restart = document.getElementById('restart-btn');
  if (restart) restart.addEventListener('click', () => { playClick(A); startGame(true); });
  const start = document.getElementById('start-btn');
  if (start) start.addEventListener('click', () => { playClick(A); startGame(); });
  const cont = document.getElementById('continue-btn');
  if (cont) cont.addEventListener('click', () => { playClick(A); startGame(false, true); });
}

function startGame(fresh = false, cont = false) {
  initAudio(A);
  const saved = loadGame();
  if (fresh) {
    Object.assign(G, createState());
    G.player.x = 0; G.player.z = 60;
  }
  if (cont && saved) applySave(G, saved);
  G.screen = 'play';
  G.paused = false;
  G.bigMap = false;
  document.getElementById('hud').style.display = 'block';
  showMenu(H, '', '', false);
  if (!M.active && G.missionIndex < MISSIONS.length) startMission(M, G, ctx, G.missionIndex);
  startMusic(A);
  G.missionMsg = G.missionMsg || MISSIONS[G.missionIndex]?.briefing || '';
}

const ctx = { G, V, P, C, M, POL, scene, colliders, playerMesh, camera };

// --- title screen ---
function showTitle() {
  G.screen = 'title';
  document.getElementById('hud').style.display = 'none';
  const save = hasSave();
  showMenu(H, 'VISTA BAY',
    `A sun-soaked open-world crime story. Steal cars, outrun the Bay PD, run 9 missions for Mara Voss — and take the city from Rook.<br><br>
    <b>WASD</b> move / drive &nbsp; <b>Mouse drag</b> camera &nbsp; <b>Click</b> shoot &nbsp; <b>E</b> steal / exit car &nbsp; <b>F</b> punch &nbsp; <b>R</b> reload &nbsp; <b>M</b> map &nbsp; <b>P</b> pause<br><br>
    <button id="start-btn">Start new day</button>${save ? ' <button id="continue-btn">Continue ($' + (loadGame()?.cash ?? 0) + ' saved)</button>' : ''}`,
    true);
  bindMenuButtons();
}

// --- debug probe for automated playtests (read-only state + a few setters) ---
window.__VB = {
  state() {
    const p = G.player;
    return {
      screen: G.screen, cash: G.cash, wanted: G.wanted, health: Math.round(G.health),
      ammo: G.ammo, reserveAmmo: G.reserveAmmo, inCar: p.inCar,
      speed: p.inCar && p.car ? Math.round(Math.abs(p.car.speed) * 3.6) : 0,
      x: Math.round((p.inCar && p.car ? p.car.x : p.x) * 10) / 10,
      z: Math.round((p.inCar && p.car ? p.car.z : p.z) * 10) / 10,
      angle: Math.round(((p.inCar && p.car ? p.car.angle : p.angle)) * 100) / 100,
      missionIndex: G.missionIndex, missionMsg: G.missionMsg,
      missionTimer: Math.round(G.missionTimer || 0),
      kills: G.kills, carsStolen: G.carsStolen, hasSave: hasSave(),
      paused: G.paused, bigMap: G.bigMap, shotReady: !!window.__shotReady,
      policeCars: POL.cars.length, policeCops: POL.cops.length,
      enemiesAlive: C.enemies.filter(e => e.alive).length,
    };
  },
  parked() { return V.parked.map(c => ({ x: Math.round(c.x), z: Math.round(c.z), stolen: c.stolen, destroyed: c.destroyed })); },
  teleport(x, z) { G.player.x = x; G.player.z = z; if (G.player.car) { G.player.car.x = x; G.player.car.z = z; } },
  setWanted(n) { G.wanted = n; },
  startMission(i) { G.missionIndex = i; startMission(M, G, ctx, i); },
};

// --- main loop ---
let last = performance.now();
let titleOrbit = 0;
function frame(now) {
  requestAnimationFrame(frame);
  // Clamp the frame step so a stall (hidden tab, slow software renderer)
  // is dropped, not replayed — but keep it wide enough (0.1 s) that the
  // game still tracks real time on a weak machine instead of crawling.
  const dt = Math.min(0.1, Math.max(0.001, (now - last) / 1000));
  last = now;
  if (G.screen === 'title') {
    // slow orbit over downtown behind the menu
    titleOrbit += dt * 0.05;
    camera.position.set(Math.sin(titleOrbit) * 120, 55, Math.cos(titleOrbit) * 120);
    camera.lookAt(0, 10, 0);
    updateTraffic(V, dt, null);
    updatePedestrians(P, dt, colliders);
    renderer.render(scene, camera);
    return;
  }
  if (G.screen === 'paused' || G.screen === 'over' || G.screen === 'win') {
    if (G.screen === 'win' && !G.flags.winShown) {
      G.flags.winShown = true;
      showMenu(H, 'YOU OWN VISTA BAY', `Rook is finished and the city is yours.<br>Cash: $${G.cash} · Missions: 9/9 · Kills: ${G.kills}<br><br><button id="start-btn">Play again</button>`, true);
      bindMenuButtons();
    }
    renderer.render(scene, camera);
    return;
  }
  G.time += dt;
  const input = inputState();
  const prevMission = G.missionIndex;
  const prevCash = G.cash;

  if (G.player.inCar && G.player.car) {
    const car = G.player.car;
    if (car.destroyed) { G.player.inCar = false; G.player.car = null; onWasted(); }
    else {
      driveCar(car, input, dt, colliders);
      G.stats.distanceDriven += Math.abs(car.speed) * dt;
      // bumping traffic slows you down
      for (const t of V.traffic) {
        if (t.destroyed) continue;
        if (Math.hypot(t.x - car.x, t.z - car.z) < 3.4) { car.speed *= 0.92; t.speed *= 0.8; }
      }
    }
  } else {
    updatePlayer(G, playerMesh, input, dt, colliders);
  }
  updateTraffic(V, dt, G.player.car);
  updatePedestrians(P, dt, colliders);
  updatePolice(POL, G, dt, onBusted, onWasted);
  updateEnemies(C, G, dt, onWasted);
  const mStatus = updateMissions(M, G, ctx, dt);
  if (mStatus === 'complete') { playMissionComplete(A); playPickup(A); }
  if (mStatus === 'failed') { playBusted(A); if (G.missionIndex < MISSIONS.length) startMission(M, G, ctx, G.missionIndex); }
  if (G.cash > prevCash && mStatus !== 'complete') playPickup(A);

  // slow health regen while the heat is off
  if (G.wanted === 0 && G.health < 100 && G.health > 0) G.health = Math.min(100, G.health + 2 * dt);
  if (G.health <= 0 && G.screen === 'play') onWasted();

  updateCamera(G, camera, dt, dragging);
  updateHud(H, G, V, POL, M);
  updateAudio(A, G);
  crosshair.style.display = G.player.inCar ? 'none' : 'block';
  renderer.render(scene, camera);
}

if (shotName) {
  // stage the requested scene, then run the live loop so the frame is real
  showTitle();
  const screen = stageShot(shotName, ctx);
  if (screen === 'title') { showTitle(); }
  else { showMenu(H, '', '', false); G.screen = 'play'; document.getElementById('hud').style.display = 'block'; }
  // let the world settle for a few frames, then flag ready
  let frames = 0;
  const settle = () => {
    frames += 1;
    if (frames >= 5) { window.__shotReady = true; return; }
    requestAnimationFrame(settle);
  };
  requestAnimationFrame(settle);
  requestAnimationFrame(frame);
} else {
  showTitle();
  requestAnimationFrame(frame);
}
