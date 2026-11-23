// Vista Bay — HUD: wanted stars, cash, health, ammo, speed, mission
// objective + beacon, dialogue line, circular minimap and the M-key big map.
const THREE = window.THREE;
import { MISSIONS, missionObjective } from './missions.js';
import { LANDMARKS } from './city.js';

export function createHud() {
  const $ = (id) => document.getElementById(id);
  return {
    stars: $('stars'), cash: $('cash'), health: $('health-fill'), healthText: $('health-text'),
    ammo: $('ammo'), speed: $('speed'), objective: $('objective'), dialog: $('dialog'),
    toast: $('toast'), minimap: $('minimap'), bigmap: $('bigmap'), bigmapCanvas: $('bigmap-canvas'),
    menu: $('menu'), menuTitle: $('menu-title'), menuText: $('menu-text'),
    screen: $('screen-label'),
  };
}

function drawMap(ctx, w, h, px, pz, yaw, V, P, M, G, scale) {
  // world -300..300 (plus pier to 410) mapped onto the canvas
  const S = scale; // px per metre
  const cx = w / 2, cy = h / 2;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#274b2e';
  ctx.fillRect(0, 0, w, h);
  const toX = (x) => cx + (x - px) * S;
  const toY = (z) => cy + (z - pz) * S;
  // sea + beach
  ctx.fillStyle = '#2a7fc2';
  ctx.fillRect(toX(300), 0, w, h);
  ctx.fillStyle = '#e8d29a';
  ctx.fillRect(toX(240), 0, toX(300) - toX(240), h);
  // roads
  ctx.strokeStyle = '#3a3d42'; ctx.lineWidth = Math.max(2, 8 * S);
  for (const s of [-240, -180, -120, -60, 0, 60, 120, 180, 240]) {
    ctx.beginPath(); ctx.moveTo(toX(s), toY(-300)); ctx.lineTo(toX(s), toY(300)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(toX(-300), toY(s)); ctx.lineTo(toX(300), toY(s)); ctx.stroke();
  }
  // landmarks
  ctx.font = 'bold 11px sans-serif';
  for (const [key, lm] of Object.entries(LANDMARKS)) {
    ctx.fillStyle = key === 'casino' ? '#ffd23b' : key === 'hospital' ? '#ff5555' : '#ffffff';
    ctx.beginPath(); ctx.arc(toX(lm.x), toY(lm.z), 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(lm.label, toX(lm.x) + 6, toY(lm.z) + 4);
  }
  // mission beacon
  if (M && M.active) {
    ctx.fillStyle = '#ffd23b';
    ctx.beginPath(); ctx.arc(toX(M.beaconPos.x), toY(M.beaconPos.z), 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffd23b'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(toX(M.beaconPos.x), toY(M.beaconPos.z), 11 + Math.sin(Date.now() / 200) * 3, 0, Math.PI * 2); ctx.stroke();
  }
  // parked cars (stealable) as grey dots, police as blue
  if (V) {
    ctx.fillStyle = '#bbbbbb';
    for (const c of V.parked) {
      if (c.destroyed || c.stolen) continue;
      ctx.fillRect(toX(c.x) - 2, toY(c.z) - 2, 4, 4);
    }
  }
  if (P) {
    ctx.fillStyle = '#4488ff';
    for (const c of P.cars) { ctx.beginPath(); ctx.arc(toX(c.x), toY(c.z), 4, 0, Math.PI * 2); ctx.fill(); }
    for (const c of P.cops) { ctx.beginPath(); ctx.arc(toX(c.x), toY(c.z), 3, 0, Math.PI * 2); ctx.fill(); }
  }
  // player arrow
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.atan2(Math.sin(yaw), Math.cos(yaw)) * -1 + Math.PI);
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(-6, 7); ctx.closePath(); ctx.fill();
  ctx.restore();
}

export function updateHud(H, G, V, P, M) {
  H.stars.textContent = '★'.repeat(G.wanted) + '☆'.repeat(5 - G.wanted);
  H.stars.style.color = G.wanted > 0 ? '#ffd23b' : '#ffffff';
  H.cash.textContent = `$${G.cash.toLocaleString('en-US')}`;
  H.health.style.width = `${Math.max(0, G.health)}%`;
  H.health.style.background = G.health > 50 ? '#3ecf5a' : G.health > 25 ? '#f2a230' : '#e23b2e';
  H.healthText.textContent = `${Math.ceil(Math.max(0, G.health))} HP`;
  H.ammo.textContent = `🔫 ${G.ammo} / ${G.reserveAmmo}`;
  const p = G.player;
  const speed = p.inCar && p.car ? Math.abs(p.car.speed) * 3.6 : (p.moving ? (p.running ? 30 : 16) : 0);
  H.speed.textContent = p.inCar ? `${Math.round(speed)} km/h` : (p.moving ? 'On foot' : '');
  H.objective.textContent = missionObjective(G);
  if (G.missionTimer > 0) H.objective.textContent += `  ⏱ ${Math.ceil(G.missionTimer)}s`;
  H.dialog.textContent = G.missionMsg || '';

  // circular minimap
  const c = H.minimap;
  const ctx = c.getContext('2d');
  const px = p.inCar && p.car ? p.car.x : p.x;
  const pz = p.inCar && p.car ? p.car.z : p.z;
  const yaw = p.inCar && p.car ? p.car.angle : p.angle;
  ctx.save();
  ctx.beginPath(); ctx.arc(80, 80, 78, 0, Math.PI * 2); ctx.clip();
  drawMap(ctx, 160, 160, px, pz, yaw, V, P, M, G, 0.55);
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(80, 80, 78, 0, Math.PI * 2); ctx.stroke();

  if (G.bigMap) {
    H.bigmap.style.display = 'block';
    const bc = H.bigmapCanvas.getContext('2d');
    drawMap(bc, 640, 640, 0, 0, 0, V, P, M, G, 0.95);
  } else {
    H.bigmap.style.display = 'none';
  }
}

export function showMenu(H, title, text, show) {
  H.menu.style.display = show ? 'flex' : 'none';
  H.menuTitle.textContent = title;
  H.menuText.innerHTML = text;
  H.screen.textContent = title;
}

export function toast(H, msg) {
  H.toast.textContent = msg;
  H.toast.style.opacity = '1';
  setTimeout(() => { H.toast.style.opacity = '0'; }, 2600);
}
