// Vista Bay — shared game state, save/load, wanted & economy.
// One plain object (G) is passed to every system so each file owns one job.
export const SAVE_KEY = 'vista-bay-save-v1';
export const WORLD_SIZE = 600; // metres, -300..300
export const HALF = 300;

export function createState() {
  return {
    time: 0,
    screen: 'title', // title | play | paused | over | win
    paused: false,
    bigMap: false,
    cash: 250,
    health: 100,
    maxHealth: 100,
    ammo: 24,
    reserveAmmo: 96,
    wanted: 0,
    heatTimer: 0, // seconds since any cop was near
    hiddenTimer: 0,
    missionIndex: 0, // 0..8, 9 = all done
    missionStage: 0,
    missionTimer: 0,
    missionMsg: '',
    missionExtra: '', // live progress line, e.g. "2 gunmen left"
    missionDone: [false, false, false, false, false, false, false, false, false],
    kills: 0,
    carsStolen: 0,
    shotsFired: 0,
    deaths: 0,
    busted: false,
    player: {
      x: 0, z: 60, angle: 0, speed: 0,
      inCar: false, car: null, // reference to vehicle object
      moving: false, running: false,
    },
    camera: { yaw: Math.PI, pitch: 0.32, dist: 9 }, // starts behind the player, who faces +z
    stats: { distanceDriven: 0, missionsCompleted: 0 },
    flags: {},
  };
}

export function saveGame(G) {
  try {
    const data = {
      cash: G.cash, health: G.health, ammo: G.ammo, reserveAmmo: G.reserveAmmo,
      wanted: 0, missionIndex: G.missionIndex, missionDone: G.missionDone,
      kills: G.kills, carsStolen: G.carsStolen,
      px: G.player.x, pz: G.player.z,
      savedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch { return false; }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch { return null; }
}

export function hasSave() {
  try { return !!window.localStorage.getItem(SAVE_KEY); } catch { return false; }
}

export function applySave(G, data) {
  if (!data) return;
  G.cash = data.cash ?? G.cash;
  G.health = data.health ?? 100;
  G.ammo = data.ammo ?? 24;
  G.reserveAmmo = data.reserveAmmo ?? 96;
  G.missionIndex = data.missionIndex ?? 0;
  G.missionDone = data.missionDone ?? G.missionDone;
  G.kills = data.kills ?? 0;
  G.carsStolen = data.carsStolen ?? 0;
  if (typeof data.px === 'number') { G.player.x = data.px; G.player.z = data.pz; }
}

// Wanted helpers: 0..5 stars.
export function addWanted(G, n) {
  G.wanted = Math.max(0, Math.min(5, G.wanted + n));
  G.heatTimer = 0;
}
export function setWanted(G, n) { G.wanted = Math.max(0, Math.min(5, n)); G.heatTimer = 0; }

// Getting caught or killed costs 20% of cash and respawns at the hospital.
export function loseCashPenalty(G) {
  const lost = Math.floor(G.cash * 0.2);
  G.cash -= lost;
  return lost;
}
