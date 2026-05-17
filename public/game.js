// =============================================
// LONG RANGE SACRIFICE — Full 3D Sniper Game
// =============================================

const socket = io();

// ---- Scene Setup ----
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x87ceeb, 80, 400);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.05, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

// ---- Lighting ----
const sun = new THREE.DirectionalLight(0xfff0d0, 1.2);
sun.position.set(100, 200, 80);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 0.5;
sun.shadow.camera.far = 500;
sun.shadow.camera.left = -200;
sun.shadow.camera.right = 200;
sun.shadow.camera.top = 200;
sun.shadow.camera.bottom = -200;
scene.add(sun);
scene.add(new THREE.AmbientLight(0x4466aa, 0.6));
scene.add(new THREE.HemisphereLight(0x87ceeb, 0x2d5a1b, 0.4));

// ---- Sky ----
scene.background = new THREE.Color(0x7ec8e3);

// ---- Terrain ----
const terrainGeo = new THREE.PlaneGeometry(800, 800, 80, 80);
const terrainVerts = terrainGeo.attributes.position;
for (let i = 0; i < terrainVerts.count; i++) {
  const x = terrainVerts.getX(i);
  const z = terrainVerts.getY(i);
  const h = Math.sin(x * 0.04) * 1.5 + Math.cos(z * 0.03) * 1.5
           + Math.sin(x * 0.1 + z * 0.08) * 0.8;
  terrainVerts.setZ(i, h);
}
terrainGeo.computeVertexNormals();
const terrainMat = new THREE.MeshStandardMaterial({ color: 0x3a7d44, roughness: 0.9 });
const terrain = new THREE.Mesh(terrainGeo, terrainMat);
terrain.rotation.x = -Math.PI / 2;
terrain.receiveShadow = true;
scene.add(terrain);

// ---- Buildings ----
const buildingData = [];
const bMat = new THREE.MeshStandardMaterial({ color: 0x8a8a8a, roughness: 0.8 });
const roofMat = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.9 });
const rng = (a, b) => Math.random() * (b - a) + a;

for (let i = 0; i < 50; i++) {
  const w = rng(4, 14), d = rng(4, 14), h = rng(4, 20);
  const x = rng(-180, 180), z = rng(-180, 180);
  if (Math.abs(x) < 12 && Math.abs(z) < 12) continue;

  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, bMat);
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  // Roof detail
  const roofGeo = new THREE.BoxGeometry(w + 0.4, 0.4, d + 0.4);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(x, h + 0.2, z);
  scene.add(roof);

  buildingData.push({ x, z, w, d, h });
}

// ---- Trees ----
for (let i = 0; i < 80; i++) {
  const x = rng(-200, 200), z = rng(-200, 200);
  const trunkH = rng(3, 6);
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.2, 0.3, trunkH, 6),
    new THREE.MeshStandardMaterial({ color: 0x4a3728 })
  );
  trunk.position.set(x, trunkH / 2, z);
  trunk.castShadow = true;
  scene.add(trunk);

  const leaves = new THREE.Mesh(
    new THREE.ConeGeometry(rng(1.5, 3), rng(3, 6), 7),
    new THREE.MeshStandardMaterial({ color: 0x1a6b2a })
  );
  leaves.position.set(x, trunkH + 2, z);
  leaves.castShadow = true;
  scene.add(leaves);
}

// ---- Water tower ----
const tower = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 16, 12), new THREE.MeshStandardMaterial({ color: 0x6b4c2a }));
tower.position.set(-60, 8, -50);
tower.castShadow = true;
scene.add(tower);

// ---- Gun model (viewmodel) ----
const gunGroup = new THREE.Group();
// Stock
const stockMesh = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.08, 0.6), new THREE.MeshStandardMaterial({ color: 0x3a2a1a }));
stockMesh.position.set(0.12, -0.08, -0.3);
gunGroup.add(stockMesh);
// Barrel
const barrelMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.9, 8), new THREE.MeshStandardMaterial({ color: 0x111 }));
barrelMesh.rotation.x = Math.PI / 2;
barrelMesh.position.set(0.12, -0.07, -0.85);
gunGroup.add(barrelMesh);
// Scope body
const scopeBody = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x222 }));
scopeBody.rotation.x = Math.PI / 2;
scopeBody.position.set(0.12, -0.01, -0.45);
gunGroup.add(scopeBody);
// Bolt
const boltMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.1, 6), new THREE.MeshStandardMaterial({ color: 0x555 }));
boltMesh.rotation.z = Math.PI / 2;
boltMesh.position.set(0.21, -0.05, -0.38);
gunGroup.add(boltMesh);
scene.add(gunGroup);

// ---- Player State ----
const playerState = {
  x: 0, y: 1.7, z: 0,
  velY: 0,
  onGround: false,
  health: 100,
  kills: 0,
  deaths: 0,
  scoped: false,
  canShoot: true,
  boltTime: 1.2,
  alive: true
};

// ---- Camera / Mouse ----
let yaw = 0, pitch = 0;
const keys = {};
let mouseLocked = false;

document.addEventListener('keydown', e => { keys[e.code] = true; });
document.addEventListener('keyup', e => { keys[e.code] = false; });

// ---- Remote Players ----
const remotePlayers = {};
const PLAYER_GEO = new THREE.BoxGeometry(0.8, 1.7, 0.5);
const REMOTE_MAT = new THREE.MeshStandardMaterial({ color: 0xe05a00 });
const HEAD_GEO = new THREE.BoxGeometry(0.5, 0.5, 0.5);

function createRemotePlayer(id) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(PLAYER_GEO, REMOTE_MAT.clone());
  body.position.y = 0.85;
  body.castShadow = true;
  const head = new THREE.Mesh(HEAD_GEO, REMOTE_MAT.clone());
  head.position.y = 1.95;
  head.castShadow = true;

  // Name tag
  const canvas = document.createElement('canvas');
  canvas.width = 256; canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 28px Courier New';
  ctx.textAlign = 'center';
  ctx.fillText(id.substring(0, 8), 128, 42);
  const tex = new THREE.CanvasTexture(canvas);
  const nameTag = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.4),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false })
  );
  nameTag.position.y = 2.6;
  nameTag.userData.isNameTag = true;

  group.add(body);
  group.add(head);
  group.add(nameTag);
  scene.add(group);
  return { group, body, head, nameTag, name: id.substring(0, 8), kills: 0, deaths: 0 };
}

// ---- Bullets (visual) ----
const bulletTrails = [];
const TRACER_MAT = new THREE.LineBasicMaterial({ color: 0xffdd66, transparent: true, opacity: 0.8 });

function spawnTracer(ox, oy, oz, dx, dy, dz) {
  const len = 15;
  const pts = [
    new THREE.Vector3(ox, oy, oz),
    new THREE.Vector3(ox + dx * len, oy + dy * len, oz + dz * len)
  ];
  const geo = new THREE.BufferGeometry().setFromPoints(pts);
  const line = new THREE.Line(geo, TRACER_MAT.clone());
  scene.add(line);
  bulletTrails.push({ line, life: 0.25, mat: line.material });
}

// ---- Muzzle Flash ----
const flashLight = new THREE.PointLight(0xffaa00, 0, 3);
scene.add(flashLight);

function doMuzzleFlash() {
  flashLight.intensity = 8;
  setTimeout(() => { flashLight.intensity = 0; }, 60);
}

// ---- Scope ----
const scopeEl = document.getElementById('scope');
const crosshair = document.getElementById('crosshair');
const crosshairDot = document.getElementById('crosshair-dot');
let scopeActive = false;

function setScope(on) {
  scopeActive = on;
  playerState.scoped = on;
  if (on) {
    scopeEl.classList.add('active');
    crosshair.style.display = 'none';
    crosshairDot.style.display = 'none';
    camera.fov = 12;
  } else {
    scopeEl.classList.remove('active');
    crosshair.style.display = '';
    crosshairDot.style.display = '';
    camera.fov = 75;
  }
  camera.updateProjectionMatrix();
}

// ---- Shoot ----
function shoot() {
  if (!playerState.canShoot || !playerState.alive) return;
  playerState.canShoot = false;

  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);

  const ox = camera.position.x, oy = camera.position.y, oz = camera.position.z;

  socket.emit('shoot', { ox, oy, oz, dx: dir.x, dy: dir.y, dz: dir.z });
  spawnTracer(ox, oy, oz, dir.x, dir.y, dir.z);
  doMuzzleFlash();

  // Bolt action
  const boltOverlay = document.getElementById('bolt-overlay');
  boltOverlay.classList.add('flash');
  setTimeout(() => boltOverlay.classList.remove('flash'), 80);

  // Gun recoil anim
  gunRecoil();

  // Unscope after shot
  if (scopeActive) setScope(false);

  // Reload time
  updateAmmo('cycling');
  setTimeout(() => {
    playerState.canShoot = true;
    updateAmmo('ready');
  }, playerState.boltTime * 1000);
}

let recoilTimer = 0;
function gunRecoil() {
  recoilTimer = 0.25;
}

function updateAmmo(state) {
  const el = document.getElementById('ammo');
  if (state === 'cycling') {
    el.innerHTML = '<span style="color:#f80">CYCLING...</span>';
  } else {
    el.innerHTML = '1<span> / ∞</span>';
  }
}

// ---- Hit marker ----
function showHitMarker() {
  const hm = document.getElementById('hitmarker');
  hm.classList.add('show');
  setTimeout(() => hm.classList.remove('show'), 200);
}

// ---- Kill feed ----
function addKillFeed(killer, victim) {
  const feed = document.getElementById('killfeed');
  const entry = document.createElement('div');
  entry.className = 'kill-entry';
  entry.innerHTML = `<span class="killer">${killer}</span> &nbsp;☠&nbsp; <span class="victim">${victim}</span>`;
  feed.appendChild(entry);
  setTimeout(() => entry.remove(), 4200);
}

// ---- Health ----
function setHealth(h) {
  playerState.health = Math.max(0, h);
  const bar = document.getElementById('health-bar');
  bar.style.width = playerState.health + '%';
  bar.style.background = playerState.health > 50 ? '#0c0' : playerState.health > 25 ? '#fa0' : '#f00';
}

// ---- Stats ----
function updateStats() {
  document.getElementById('stat-kills').textContent = playerState.kills;
  document.getElementById('stat-deaths').textContent = playerState.deaths;
  document.getElementById('stat-players').textContent = Object.keys(remotePlayers).length + 1;
}

// ---- Mouse ----
document.addEventListener('click', () => {
  if (!mouseLocked && document.getElementById('menu').style.display === 'none') {
    renderer.domElement.requestPointerLock();
  }
});

document.addEventListener('pointerlockchange', () => {
  mouseLocked = !!document.pointerLockElement;
});

document.addEventListener('mousemove', e => {
  if (!mouseLocked) return;
  const sens = scopeActive ? 0.0008 : 0.002;
  yaw -= e.movementX * sens;
  pitch -= e.movementY * sens;
  pitch = Math.max(-Math.PI * 0.45, Math.min(Math.PI * 0.45, pitch));
});

document.addEventListener('mousedown', e => {
  if (!mouseLocked) return;
  if (e.button === 0) shoot();
  if (e.button === 2) setScope(!scopeActive);
});

document.addEventListener('keydown', e => {
  if (e.code === 'KeyF') setScope(!scopeActive);
  if (e.code === 'Escape') setScope(false);
});

document.addEventListener('contextmenu', e => e.preventDefault());

// ---- Socket Events ----
socket.on('init', ({ id, players }) => {
  document.getElementById('connecting').classList.remove('show');
  for (let pid in players) {
    if (pid === id) {
      playerState.x = players[pid].x;
      playerState.y = players[pid].y;
      playerState.z = players[pid].z;
    } else {
      remotePlayers[pid] = createRemotePlayer(pid);
      remotePlayers[pid].group.position.set(players[pid].x, 0, players[pid].z);
    }
  }
  updateStats();
  document.getElementById('players-online').textContent =
    `${Object.keys(players).length} player${Object.keys(players).length !== 1 ? 's' : ''} online`;
});

socket.on('playerJoined', ({ id, player }) => {
  remotePlayers[id] = createRemotePlayer(id);
  remotePlayers[id].group.position.set(player.x, 0, player.z);
  updateStats();
});

socket.on('playerMoved', ({ id, x, y, z, rotY }) => {
  if (remotePlayers[id]) {
    remotePlayers[id].group.position.set(x, 0, z);
    remotePlayers[id].group.rotation.y = rotY || 0;
    // Name tags always face camera
    remotePlayers[id].nameTag && (remotePlayers[id].nameTag.lookAt(camera.position));
  }
});

socket.on('bulletFired', ({ id, ox, oy, oz, dx, dy, dz }) => {
  spawnTracer(ox, oy, oz, dx, dy, dz);
});

socket.on('playerKilled', ({ killer, victim, killerName, victimName, spawnX, spawnZ }) => {
  addKillFeed(killerName || killer.substring(0, 8), victimName || victim.substring(0, 8));

  const myId = socket.id;
  if (victim === myId) {
    // I died
    playerState.deaths++;
    setHealth(100);
    playerState.alive = false;
    const ds = document.getElementById('death-screen');
    ds.classList.add('show');
    setTimeout(() => {
      playerState.x = spawnX;
      playerState.z = spawnZ;
      playerState.y = 1.7;
      playerState.alive = true;
      ds.classList.remove('show');
    }, 2000);
  }
  if (killer === myId) {
    playerState.kills++;
    showHitMarker();
  }
  // Respawn remote player visually
  if (remotePlayers[victim]) {
    remotePlayers[victim].group.position.set(spawnX, 0, spawnZ);
  }
  updateStats();
});

socket.on('scoreUpdate', ({ id, kills, id2, deaths }) => {
  if (id === socket.id) playerState.kills = kills;
  if (id2 === socket.id) playerState.deaths = deaths;
  updateStats();
});

socket.on('playerLeft', (id) => {
  if (remotePlayers[id]) {
    scene.remove(remotePlayers[id].group);
    delete remotePlayers[id];
  }
  updateStats();
});

socket.on('nameUpdate', ({ id, name }) => {
  if (remotePlayers[id]) remotePlayers[id].name = name;
});

socket.on('connect', () => {
  document.getElementById('players-online').textContent = 'Connected — enter your callsign';
});

// ---- Menu ----
document.getElementById('play-btn').addEventListener('click', startGame);
document.getElementById('name-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') startGame();
});

function startGame() {
  const name = document.getElementById('name-input').value.trim() || 'Ghost';
  socket.emit('setName', name);
  document.getElementById('menu').style.display = 'none';
  renderer.domElement.requestPointerLock();
}

// ---- Collision helpers ----
function getTerrainY(x, z) {
  // Approximate terrain height formula matching geometry
  return Math.sin(x * 0.04) * 1.5 + Math.cos(z * 0.03) * 1.5
       + Math.sin(x * 0.1 + z * 0.08) * 0.8;
}

function checkBuildingCollision(nx, nz) {
  for (const b of buildingData) {
    const hw = b.w / 2 + 0.5, hd = b.d / 2 + 0.5;
    if (nx > b.x - hw && nx < b.x + hw && nz > b.z - hd && nz < b.z + hd) return true;
  }
  return false;
}

// ---- Game Loop ----
const clock = new THREE.Clock();
let moveTimer = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (playerState.alive && mouseLocked) {
    // Movement
    const speed = keys['ShiftLeft'] ? 8 : 4;
    const sinY = Math.sin(yaw), cosY = Math.cos(yaw);

    let mx = 0, mz = 0;
    if (keys['KeyW']) { mx += sinY; mz += cosY; }
    if (keys['KeyS']) { mx -= sinY; mz -= cosY; }
    if (keys['KeyA']) { mx += cosY; mz -= sinY; }
    if (keys['KeyD']) { mx -= cosY; mz += sinY; }

    const len = Math.sqrt(mx * mx + mz * mz);
    if (len > 0) { mx /= len; mz /= len; }

    const nx = playerState.x + mx * speed * dt;
    const nz = playerState.z + mz * speed * dt;

    if (!checkBuildingCollision(nx, nz)) {
      playerState.x = Math.max(-200, Math.min(200, nx));
      playerState.z = Math.max(-200, Math.min(200, nz));
    }

    // Gravity / jump
    const groundY = getTerrainY(playerState.x, playerState.z) + 1.7;
    if (playerState.y > groundY) {
      playerState.velY -= 18 * dt;
      playerState.y += playerState.velY * dt;
      playerState.onGround = false;
    } else {
      playerState.y = groundY;
      playerState.velY = 0;
      playerState.onGround = true;
    }

    if ((keys['Space'] || keys['KeyQ']) && playerState.onGround) {
      playerState.velY = 7;
    }

    // Camera
    const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
    camera.quaternion.setFromEuler(euler);
    camera.position.set(playerState.x, playerState.y, playerState.z);

    // Gun sway / recoil
    gunGroup.position.set(0.18, -0.16, -0.35);
    if (recoilTimer > 0) {
      recoilTimer -= dt;
      const r = Math.max(0, recoilTimer / 0.25);
      gunGroup.position.z += r * 0.12;
      gunGroup.position.y -= r * 0.04;
    }
    gunGroup.rotation.copy(camera.rotation);
    gunGroup.position.applyEuler(camera.rotation);
    gunGroup.position.add(camera.position);

    // Muzzle flash position
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
    flashLight.position.copy(camera.position).addScaledVector(fwd, 0.5);

    // Emit movement
    moveTimer += dt;
    if (moveTimer > 0.05) {
      socket.emit('move', { x: playerState.x, y: playerState.y, z: playerState.z, rotY: yaw });
      moveTimer = 0;
    }
  }

  // Remote player name tags face camera
  for (const pid in remotePlayers) {
    const rp = remotePlayers[pid];
    rp.group.traverse(obj => {
      if (obj.userData.isNameTag) obj.lookAt(camera.position);
    });
  }

  // Bullet trails fade
  for (let i = bulletTrails.length - 1; i >= 0; i--) {
    bulletTrails[i].life -= dt;
    bulletTrails[i].mat.opacity = Math.max(0, bulletTrails[i].life / 0.25) * 0.8;
    if (bulletTrails[i].life <= 0) {
      scene.remove(bulletTrails[i].line);
      bulletTrails.splice(i, 1);
    }
  }

  renderer.render(scene, camera);
}

animate();

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- Connecting overlay ----
document.getElementById('connecting').classList.add('show');
