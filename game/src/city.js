// Vista Bay — procedural city: roads, downtown towers, beach, pier, sea,
// palm avenue, casino, hospital, park, airport runway. Sunny afternoon + fog.
// Exports the road graph, building colliders (AABBs) and landmark positions
// that vehicles, pedestrians, police and missions all share.
// Three.js r160 is vendored as a classic UMD build (game/vendor/three.min.js),
// loaded by index.html before this module, so it is the window.THREE global.
const THREE = window.THREE;

export const STREETS = [-240, -180, -120, -60, 0, 60, 120, 180, 240];
export const LANDMARKS = {
  garage: { x: -120, z: 120, label: 'Garage' },
  pier: { x: 330, z: 0, label: 'Pier' },
  pierEnd: { x: 380, z: 0, label: 'Pier End' },
  park: { x: -30, z: -90, label: 'Palm Park' },
  casino: { x: 180, z: -180, label: 'Golden Palm Casino' },
  hospital: { x: -180, z: 180, label: 'Vista General Hospital' },
  airport: { x: -200, z: -250, label: 'Vista Bay Airport' },
  runway: { x: -200, z: -255, label: 'Runway' },
  port: { x: -270, z: -30, label: 'Port' },
  downtown: { x: 0, z: 0, label: 'Downtown' },
  beach: { x: 265, z: 60, label: 'Beach' },
};

// Deterministic RNG so a seed always builds the same city.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function windowTexture(rand, base, litRatio) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, 128, 256);
  for (let y = 8; y < 248; y += 16) {
    for (let x = 8; x < 120; x += 14) {
      const lit = rand() < litRatio;
      g.fillStyle = lit ? '#ffd98a' : (rand() < 0.5 ? '#1c2b3a' : '#2c4258');
      g.fillRect(x, y, 9, 10);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePalm() {
  const group = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.14, 0.22, 5, 6),
    new THREE.MeshLambertMaterial({ color: 0x8a6b45 }));
  trunk.position.y = 2.5; trunk.rotation.z = 0.08;
  group.add(trunk);
  // one crown cone instead of six leaves: far fewer draw calls
  const crown = new THREE.Mesh(new THREE.ConeGeometry(1.7, 2.2, 7),
    new THREE.MeshLambertMaterial({ color: 0x2f9e4f }));
  crown.position.y = 5.4;
  group.add(crown);
  return group;
}

// One dashed centre line per street as a repeating texture strip (18 meshes
// total) instead of hundreds of individual dash quads. The repeat goes on
// the texture axis that runs along the street: u for the X-running strips,
// v for the Z-running ones (their long side is the plane's height).
function dashTexture(rx, ry) {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 8;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 32, 8);
  g.fillStyle = '#f5d76e';
  g.fillRect(4, 2, 16, 4);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  return tex;
}

export function buildCity(scene, seed = 7) {
  const rand = mulberry32(seed);
  const colliders = []; // {x0,z0,x1,z1}
  const group = new THREE.Group();
  group.name = 'city';

  // --- ground: grass base, sand beach strip, sea plane ---
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(600, 600),
    new THREE.MeshLambertMaterial({ color: 0x6fae5e }));
  ground.rotation.x = -Math.PI / 2; group.add(ground);
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 600),
    new THREE.MeshLambertMaterial({ color: 0xe8d29a }));
  sand.rotation.x = -Math.PI / 2; sand.position.set(270, 0.02, 0); group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(500, 700),
    new THREE.MeshLambertMaterial({ color: 0x2a7fc2 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(550, 0.01, 0); group.add(sea);

  // --- roads: dark asphalt strips + one dashed centre line per street ---
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3a3d42 });
  const dashMatX = new THREE.MeshLambertMaterial({ map: dashTexture(38, 1), transparent: true });
  const dashMatZ = new THREE.MeshLambertMaterial({ map: dashTexture(1, 38), transparent: true });
  for (const s of STREETS) {
    for (const [w, l, x, z] of [[10, 600, s, 0], [600, 10, 0, s]]) {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(w, l), roadMat);
      r.rotation.x = -Math.PI / 2; r.position.set(x, 0.03, z); group.add(r);
    }
    const d1 = new THREE.Mesh(new THREE.PlaneGeometry(600, 0.7), dashMatX);
    d1.rotation.x = -Math.PI / 2; d1.position.set(0, 0.05, s); group.add(d1);
    // cross-street strip: swap the geometry axes instead of rotating the
    // flat plane, so its long side lies along world Z
    const d2 = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 600), dashMatZ);
    d2.rotation.x = -Math.PI / 2; d2.position.set(s, 0.05, 0); group.add(d2);
  }

  // --- buildings: downtown towers near centre, low blocks elsewhere ---
  const towerTex = [windowTexture(rand, '#5b6b7d', 0.35), windowTexture(rand, '#7d8ea3', 0.3), windowTexture(rand, '#4a5a6e', 0.4)];
  const lowTex = windowTexture(rand, '#b08a5e', 0.25);
  const lowMats = [0xc9a06c, 0xa8b0b8, 0xd8c9a8, 0x9aa88f].map(c =>
    new THREE.MeshLambertMaterial({ color: c, map: lowTex }));
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  function addBuilding(x, z, w, h, d, mat) {
    const m = new THREE.Mesh(boxGeo, mat);
    m.scale.set(w, h, d); m.position.set(x, h / 2, z);
    group.add(m);
    // rooftop box so towers read as buildings from above
    const roof = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x333a44 }));
    roof.scale.set(w * 0.3, 2, d * 0.3); roof.position.set(x, h + 1, z); group.add(roof);
    colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2 });
  }
  for (let gx = 0; gx < 8; gx++) {
    for (let gz = 0; gz < 8; gz++) {
      const cx = -210 + gx * 60, cz = -210 + gz * 60;
      if (Math.abs(cx) > 240 || Math.abs(cz) > 240) continue;
      // keep landmark plots and the airport clear
      if (cx === -210 && cz === -210) continue; // airport block
      if (cx === 180 && cz === -180) continue; // casino plot
      if (cx === -180 && cz === 180) continue; // hospital plot
      if (cx === -30 && cz === -90) continue; // park plot (approx via -30,-90 block)
      if (Math.abs(cx) < 1 && Math.abs(cz) < 1) continue; // plaza
      const distC = Math.hypot(cx, cz);
      const tower = distC < 130 && rand() < 0.85;
      if (tower) {
        const h = 45 + rand() * 70;
        addBuilding(cx + (rand() - 0.5) * 8, cz + (rand() - 0.5) * 8, 26 + rand() * 10, h, 26 + rand() * 10,
          new THREE.MeshLambertMaterial({ map: towerTex[Math.floor(rand() * 3)] }));
      } else if (rand() < 0.8) {
        addBuilding(cx + (rand() - 0.5) * 10, cz + (rand() - 0.5) * 10, 22 + rand() * 8, 8 + rand() * 10, 22 + rand() * 8,
          lowMats[Math.floor(rand() * lowMats.length)]);
      }
    }
  }

  // --- Golden Palm Casino (gold tower + sign) ---
  const casino = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xd4af37 }));
  casino.scale.set(40, 34, 30); casino.position.set(180, 17, -180); group.add(casino);
  colliders.push({ x0: 160, z0: -195, x1: 200, z1: -165 });
  const sign = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xff4d8d, emissive: 0x881144 }));
  sign.scale.set(30, 5, 2); sign.position.set(180, 38, -180); group.add(sign);

  // --- Vista General Hospital (white block + red cross) ---
  const hosp = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0xf2f2ee }));
  hosp.scale.set(36, 20, 28); hosp.position.set(-180, 10, 180); group.add(hosp);
  colliders.push({ x0: -198, z0: 166, x1: -162, z1: 194 });
  const crossMat = new THREE.MeshLambertMaterial({ color: 0xd21f2b });
  const c1 = new THREE.Mesh(boxGeo, crossMat); c1.scale.set(10, 3, 1); c1.position.set(-180, 22, 180); group.add(c1);
  const c2 = new THREE.Mesh(boxGeo, crossMat); c2.scale.set(3, 10, 1); c2.position.set(-180, 22, 180); group.add(c2);

  // --- Palm Park: green lawn, pond, palms ---
  const lawn = new THREE.Mesh(new THREE.PlaneGeometry(56, 56),
    new THREE.MeshLambertMaterial({ color: 0x4da34d }));
  lawn.rotation.x = -Math.PI / 2; lawn.position.set(-30, 0.04, -90); group.add(lawn);
  const pond = new THREE.Mesh(new THREE.CircleGeometry(10, 24),
    new THREE.MeshLambertMaterial({ color: 0x3a9bc2 }));
  pond.rotation.x = -Math.PI / 2; pond.position.set(-30, 0.06, -90); group.add(pond);

  // --- Pier: wooden deck out into the sea + posts ---
  const pierMat = new THREE.MeshLambertMaterial({ color: 0x9c7a4d });
  const pier = new THREE.Mesh(boxGeo, pierMat);
  pier.scale.set(110, 1.5, 12); pier.position.set(355, 0.8, 0); group.add(pier);
  for (let x = 310; x <= 400; x += 15) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 3, 6), pierMat);
    post.position.set(x, 0, 5); group.add(post);
    const post2 = post.clone(); post2.position.z = -5; group.add(post2);
  }
  // lighthouse at pier end
  const light = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, 18, 8),
    new THREE.MeshLambertMaterial({ color: 0xf5f5f5 }));
  light.position.set(405, 9, 0); group.add(light);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 8),
    new THREE.MeshLambertMaterial({ color: 0xffe27a, emissive: 0xaa8800 }));
  lamp.position.set(405, 19, 0); group.add(lamp);

  // --- Airport runway (south-west) + terminal block ---
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(150, 24),
    new THREE.MeshLambertMaterial({ color: 0x2e3136 }));
  runway.rotation.x = -Math.PI / 2; runway.position.set(-200, 0.04, -255); group.add(runway);
  for (let x = -260; x <= -140; x += 20) {
    const mark = new THREE.Mesh(new THREE.PlaneGeometry(8, 1.5),
      new THREE.MeshLambertMaterial({ color: 0xffffff }));
    mark.rotation.x = -Math.PI / 2; mark.position.set(x, 0.06, -255); group.add(mark);
  }
  const terminal = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x8fa3b8 }));
  terminal.scale.set(50, 12, 18); terminal.position.set(-200, 6, -215); group.add(terminal);
  colliders.push({ x0: -225, z0: -224, x1: -175, z1: -206 });

  // --- Port docks (west edge): containers ---
  const contCols = [0xc23b2a, 0x2a6fc2, 0x3a9e4d, 0xd8a02a];
  for (let i = 0; i < 10; i++) {
    const c = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: contCols[i % 4] }));
    c.scale.set(12, 3, 3);
    c.position.set(-272 + (i % 2) * 8, 1.5, -70 + Math.floor(i / 2) * 14);
    c.rotation.y = (i % 3) * 0.2;
    group.add(c);
  }

  // --- Palm avenue along the beach road + scattered palms ---
  for (let z = -270; z <= 270; z += 30) {
    const p = makePalm(); p.position.set(235, 0, z); group.add(p);
    const p2 = makePalm(); p2.position.set(248, 0, z + 15); group.add(p2);
  }
  for (let i = 0; i < 40; i++) {
    const p = makePalm();
    p.position.set(-280 + rand() * 500, 0, -280 + rand() * 500);
    if (Math.abs(p.position.x) > 250) continue;
    group.add(p);
  }

  // --- sun, sky light, fog ---
  const sun = new THREE.DirectionalLight(0xfff2d0, 2.2);
  sun.position.set(180, 220, 90); scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfe3ff, 0x8a7a5a, 0.9));
  scene.fog = new THREE.Fog(0xcfe8f5, 220, 620);
  scene.background = new THREE.Color(0x9fd4ef);

  scene.add(group);
  return { group, colliders, rand };
}

// Push a circle (x,z,r) out of building AABBs; returns corrected position.
export function collideBuildings(colliders, x, z, r) {
  for (const b of colliders) {
    const cx = Math.max(b.x0, Math.min(x, b.x1));
    const cz = Math.max(b.z0, Math.min(z, b.z1));
    const dx = x - cx, dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r; z = cz + (dz / d) * r;
      } else {
        // inside the box: push out along the smallest penetration axis
        const pl = x - b.x0, pr = b.x1 - x, pt = z - b.z0, pb = b.z1 - z;
        const m = Math.min(pl, pr, pt, pb);
        if (m === pl) x = b.x0 - r; else if (m === pr) x = b.x1 + r;
        else if (m === pt) z = b.z0 - r; else z = b.z1 + r;
      }
    }
  }
  return { x, z };
}

export function clampWorld(x, z) {
  return { x: Math.max(-295, Math.min(410, x)), z: Math.max(-295, Math.min(295, z)) };
}
