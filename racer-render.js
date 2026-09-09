// ==========================================================================
// 🏎️ 3D Cyber Highway Racer - WebGL Visual Layer (racer-render.js)
// Pure rendering: consumes RacerEngine state, mutates a shared THREE.Scene.
// No physics/input/audio here - see racer-engine.js (state) and game.js
// (orchestration: input, HUD, Web Audio SFX, tab switching).
//
// Usage from game.js (shares the single scene/camera/renderer used by Snake):
//   RacerRender.init(scene);                    // once, at boot
//   RacerRender.activate(scene, camera);         // when switching TO racer
//   RacerRender.update(state, dt, camera);       // every frame while active
//   RacerRender.deactivate(scene);               // when switching AWAY
// ==========================================================================

(function () {
  'use strict';

  if (typeof THREE === 'undefined') {
    console.error('[RacerRender] Three.js not loaded. Include three.min.js before racer-render.js.');
    return;
  }

  // Falls back to sane defaults if racer-engine.js hasn't loaded yet, so this
  // file never hard-crashes the page load order.
  const LANE_WIDTH = (typeof RacerEngine !== 'undefined' && RacerEngine.LANE_WIDTH) || 3.2;
  const HIGHWAY_LENGTH = (typeof RacerEngine !== 'undefined' && RacerEngine.HIGHWAY_LENGTH) || 160;

  const ROAD_WIDTH = LANE_WIDTH * 3 + 2.2;   // 3 lanes + shoulders
  const ROAD_BACK = -40;                      // road extends behind the player
  const ROAD_FORWARD = HIGHWAY_LENGTH + 60;   // and well past the spawn distance
  const ROAD_LENGTH = ROAD_FORWARD - ROAD_BACK;

  function laneToX(laneOffset) {
    return laneOffset * LANE_WIDTH;
  }

  function flagShared(obj) {
    obj.userData = obj.userData || {};
    obj.userData.isShared = true;
    return obj;
  }

  function disposeObject(obj) {
    if (!obj) return;
    obj.traverse((child) => {
      if (!child.isMesh) return;
      if (child.geometry && !child.geometry.userData?.isShared) child.geometry.dispose();
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((m) => { if (m && !m.userData?.isShared) m.dispose(); });
    });
  }

  // ------------------------------------------------------------------------
  // Procedural asphalt + lane-stripe texture (no external image assets)
  // ------------------------------------------------------------------------
  function createRoadTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0c0e18';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle asphalt grain
    ctx.fillStyle = 'rgba(255,255,255,0.02)';
    for (let i = 0; i < 400; i++) {
      ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 1, 1);
    }

    const laneXs = [canvas.width / 3, (canvas.width / 3) * 2];
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.85)';
    ctx.lineWidth = 4;
    ctx.setLineDash([28, 22]);
    laneXs.forEach((x) => {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    });

    // Solid glowing shoulder edges
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255, 0, 170, 0.6)';
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(6, canvas.height); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(canvas.width - 6, 0); ctx.lineTo(canvas.width - 6, canvas.height); ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, ROAD_LENGTH / 8);
    flagShared(texture);
    return texture;
  }

  // ------------------------------------------------------------------------
  // Shared geometries & materials (created once, reused across activations)
  // ------------------------------------------------------------------------
  const chassisGeo = flagShared(new THREE.BoxGeometry(1.7, 0.42, 3.6));
  const cabinGeo = flagShared(new THREE.BoxGeometry(1.15, 0.4, 1.7));
  const spoilerGeo = flagShared(new THREE.BoxGeometry(1.5, 0.08, 0.26));
  const spoilerStrutGeo = flagShared(new THREE.BoxGeometry(0.08, 0.3, 0.1));
  const wheelGeo = flagShared(new THREE.CylinderGeometry(0.34, 0.34, 0.3, 16));
  const headlightGeo = flagShared(new THREE.SphereGeometry(0.13, 12, 12));
  const taillightGeo = flagShared(new THREE.SphereGeometry(0.11, 10, 10));
  const underglowGeo = flagShared(new THREE.PlaneGeometry(1.6, 3.4));

  const trafficChassisGeo = flagShared(new THREE.BoxGeometry(1.6, 0.48, 3.2));
  const trafficCabinGeo = flagShared(new THREE.BoxGeometry(1.05, 0.36, 1.3));
  const pickupGeo = flagShared(new THREE.OctahedronGeometry(0.42, 0));
  const buildingGeo = flagShared(new THREE.BoxGeometry(1, 1, 1));
  const dividerGeo = flagShared(new THREE.BoxGeometry(0.1, 0.06, ROAD_LENGTH));
  const roadGeo = flagShared(new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH));

  const carPaintMat = flagShared(new THREE.MeshStandardMaterial({
    color: 0x0a0a12, emissive: 0x00e5ff, emissiveIntensity: 0.18, roughness: 0.25, metalness: 0.75
  }));
  const carCabinMat = flagShared(new THREE.MeshStandardMaterial({
    color: 0x04060c, roughness: 0.15, metalness: 0.9
  }));
  const spoilerMat = flagShared(new THREE.MeshStandardMaterial({
    color: 0x0c0c14, emissive: 0x00e5ff, emissiveIntensity: 0.35, roughness: 0.3, metalness: 0.6
  }));
  const wheelMat = flagShared(new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.85, metalness: 0.2 }));
  const headlightMat = flagShared(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const taillightMat = flagShared(new THREE.MeshBasicMaterial({ color: 0xff0033 }));
  const underglowMat = flagShared(new THREE.MeshBasicMaterial({
    color: 0x00e5ff, transparent: true, opacity: 0.55, side: THREE.DoubleSide
  }));

  const trafficCabinMat = flagShared(new THREE.MeshStandardMaterial({ color: 0x05060a, roughness: 0.2, metalness: 0.7 }));
  const trafficTaillightMat = flagShared(new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  const trafficBodyMatCache = new Map(); // hex color -> shared MeshStandardMaterial

  function trafficBodyMat(hexColor) {
    if (!trafficBodyMatCache.has(hexColor)) {
      trafficBodyMatCache.set(hexColor, flagShared(new THREE.MeshStandardMaterial({
        color: hexColor, emissive: hexColor, emissiveIntensity: 0.3, roughness: 0.35, metalness: 0.55
      })));
    }
    return trafficBodyMatCache.get(hexColor);
  }

  const pickupMat = flagShared(new THREE.MeshStandardMaterial({
    color: 0xffee00, emissive: 0xffcc00, emissiveIntensity: 0.85, roughness: 0.15, metalness: 0.6
  }));
  const dividerMat = flagShared(new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0x00e5ff, emissiveIntensity: 0.7
  }));
  const buildingMat = flagShared(new THREE.MeshStandardMaterial({
    color: 0x090c18, emissive: 0x123a5e, emissiveIntensity: 0.3, roughness: 0.75, metalness: 0.1
  }));

  const roadTexture = createRoadTexture();
  const roadMat = flagShared(new THREE.MeshStandardMaterial({ map: roadTexture, roughness: 0.9, metalness: 0.1 }));

  // ------------------------------------------------------------------------
  // Static world (road, dividers, guardrails, parallax skyline)
  // ------------------------------------------------------------------------
  let roadGroup = null;
  let buildings = [];

  function buildRoad() {
    const group = new THREE.Group();

    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.position.set(0, 0, ROAD_BACK + ROAD_LENGTH / 2);
    roadMesh.receiveShadow = true;
    group.add(roadMesh);

    [-LANE_WIDTH / 2, LANE_WIDTH / 2].forEach((x) => {
      const divider = new THREE.Mesh(dividerGeo, dividerMat);
      divider.position.set(x, 0.03, ROAD_BACK + ROAD_LENGTH / 2);
      group.add(divider);
    });

    // Neon guardrails along both shoulders
    const railGeo = flagShared(new THREE.BoxGeometry(0.15, 0.5, ROAD_LENGTH));
    [-(ROAD_WIDTH / 2 + 0.2), ROAD_WIDTH / 2 + 0.2].forEach((x) => {
      const rail = new THREE.Mesh(railGeo, dividerMat);
      rail.position.set(x, 0.25, ROAD_BACK + ROAD_LENGTH / 2);
      group.add(rail);
    });

    // Sparse parallax skyline silhouettes on both sides
    buildings = [];
    for (let i = 0; i < 16; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const w = 2 + Math.random() * 3;
      const h = 3 + Math.random() * 10;
      const mesh = new THREE.Mesh(buildingGeo, buildingMat);
      mesh.scale.set(w, h, w);
      mesh.position.set(
        side * (ROAD_WIDTH / 2 + 4 + Math.random() * 10),
        h / 2,
        ROAD_BACK + Math.random() * ROAD_LENGTH
      );
      group.add(mesh);
      buildings.push(mesh);
    }

    return group;
  }

  // ------------------------------------------------------------------------
  // Player car (cyber sports car with glowing headlights)
  // ------------------------------------------------------------------------
  let carGroup = null;
  let headlightLights = [];
  let wheelMeshes = [];

  function buildCar() {
    const group = new THREE.Group();

    const chassis = new THREE.Mesh(chassisGeo, carPaintMat);
    chassis.position.y = 0.4;
    chassis.castShadow = true;
    group.add(chassis);

    const cabin = new THREE.Mesh(cabinGeo, carCabinMat);
    cabin.position.set(0, 0.72, -0.35);
    group.add(cabin);

    const spoiler = new THREE.Mesh(spoilerGeo, spoilerMat);
    spoiler.position.set(0, 0.78, -1.65);
    group.add(spoiler);
    [-0.6, 0.6].forEach((x) => {
      const strut = new THREE.Mesh(spoilerStrutGeo, spoilerMat);
      strut.position.set(x, 0.64, -1.65);
      group.add(strut);
    });

    wheelMeshes = [];
    [[-0.85, 1.15], [0.85, 1.15], [-0.85, -1.15], [0.85, -1.15]].forEach(([x, z]) => {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.34, z);
      wheel.castShadow = true;
      group.add(wheel);
      wheelMeshes.push(wheel);
    });

    // Glowing headlights: emissive bulb + real SpotLight so they actually light the road
    headlightLights = [];
    [-0.55, 0.55].forEach((x) => {
      const bulb = new THREE.Mesh(headlightGeo, headlightMat);
      bulb.position.set(x, 0.42, 1.78);
      group.add(bulb);

      const spot = new THREE.SpotLight(0xbfe9ff, 2.2, 22, Math.PI / 7, 0.5, 1.2);
      spot.position.set(x, 0.5, 1.85);
      const target = new THREE.Object3D();
      target.position.set(x * 0.4, -0.5, 14);
      group.add(target);
      spot.target = target;
      group.add(spot);
      headlightLights.push(spot);
    });

    // Taillights (rear glow, minor polish)
    [-0.55, 0.55].forEach((x) => {
      const tail = new THREE.Mesh(taillightGeo, taillightMat);
      tail.position.set(x, 0.42, -1.82);
      group.add(tail);
    });

    // Underglow "tron strip" beneath the chassis
    const glow = new THREE.Mesh(underglowGeo, underglowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(0, 0.06, 0);
    group.add(glow);
    group.userData.underglow = glow;

    group.position.set(0, 0, 0);
    return group;
  }

  // ------------------------------------------------------------------------
  // Traffic + nitro pickup pools (synced 1:1 against RacerEngine state)
  // ------------------------------------------------------------------------
  const trafficPool = new Map(); // id -> THREE.Group
  const pickupPool = new Map();  // id -> THREE.Group

  function buildTrafficCar(hexColor) {
    const group = new THREE.Group();
    const body = new THREE.Mesh(trafficChassisGeo, trafficBodyMat(hexColor));
    body.position.y = 0.4;
    body.castShadow = true;
    group.add(body);

    const cabin = new THREE.Mesh(trafficCabinGeo, trafficCabinMat);
    cabin.position.set(0, 0.7, 0.2);
    group.add(cabin);

    [-0.5, 0.5].forEach((x) => {
      const tail = new THREE.Mesh(taillightGeo, trafficTaillightMat);
      tail.position.set(x, 0.42, -1.62);
      group.add(tail);
    });

    return group;
  }

  function buildPickup() {
    const group = new THREE.Group();
    const gem = new THREE.Mesh(pickupGeo, pickupMat);
    group.add(gem);
    const light = new THREE.PointLight(0xffcc00, 1.4, 5);
    group.add(light);
    group.userData.spinSeed = Math.random() * Math.PI * 2;
    return group;
  }

  function syncPool(pool, items, scene, builder, idKey, place) {
    const seen = new Set();
    items.forEach((item) => {
      seen.add(item[idKey]);
      let group = pool.get(item[idKey]);
      if (!group) {
        group = builder(item);
        scene.add(group);
        pool.set(item[idKey], group);
      }
      place(group, item);
    });
    for (const [id, group] of pool) {
      if (!seen.has(id)) {
        scene.remove(group);
        disposeObject(group);
        pool.delete(id);
      }
    }
  }

  // ------------------------------------------------------------------------
  // Public API
  // ------------------------------------------------------------------------
  let initialized = false;
  let clockTime = 0;

  function init() {
    if (initialized) return;
    roadGroup = buildRoad();
    carGroup = buildCar();
    initialized = true;
  }

  function activate(scene, camera) {
    if (!initialized) init();
    scene.add(roadGroup);
    scene.add(carGroup);

    scene.background = new THREE.Color(0x05030f);
    scene.fog = new THREE.FogExp2(0x05030f, 0.018);

    if (camera) {
      camera.position.set(0, 4.2, -8.5);
      camera.lookAt(0, 1, 14);
    }
  }

  function deactivate(scene) {
    if (roadGroup) scene.remove(roadGroup);
    if (carGroup) scene.remove(carGroup);

    for (const [, group] of trafficPool) { scene.remove(group); disposeObject(group); }
    trafficPool.clear();
    for (const [, group] of pickupPool) { scene.remove(group); disposeObject(group); }
    pickupPool.clear();
  }

  function update(state, dt, camera, scene) {
    if (!state || !carGroup) return;
    clockTime += dt;

    const carX = laneToX(state.laneOffset);
    carGroup.position.x = carX;

    const steerDelta = state.targetLane - state.laneOffset;
    carGroup.rotation.z = THREE.MathUtils.clamp(-steerDelta * 0.4, -0.3, 0.3);
    carGroup.rotation.y = THREE.MathUtils.clamp(-steerDelta * 0.15, -0.15, 0.15);

    const wheelSpin = (state.speed / 3.6) * dt / 0.34; // radians, approximated from wheel radius
    wheelMeshes.forEach((w) => { w.rotation.x += wheelSpin; });

    const boostGlow = state.isBoosting ? 4.2 + Math.sin(clockTime * 40) * 0.6 : 2.2;
    headlightLights.forEach((spot) => { spot.intensity = boostGlow; });
    if (carGroup.userData.underglow) {
      carGroup.userData.underglow.material.opacity = state.isBoosting ? 0.85 : 0.4 + Math.sin(clockTime * 3) * 0.08;
      carGroup.userData.underglow.material.color.setHex(state.isBoosting ? 0xffaa00 : 0x00e5ff);
    }

    const metersThisFrame = ((state.speed * 1000) / 3600) * dt;
    roadTexture.offset.y -= metersThisFrame / 8;

    buildings.forEach((b) => {
      b.position.z -= metersThisFrame * 0.35;
      if (b.position.z < ROAD_BACK - 10) {
        b.position.z = ROAD_FORWARD - Math.random() * 20;
      }
    });

    syncPool(trafficPool, state.traffic, scene, (car) => buildTrafficCar(car.color), 'id', (group, car) => {
      group.position.set(laneToX(car.lane), 0, car.z);
    });

    syncPool(pickupPool, state.nitroPickups, scene, () => buildPickup(), 'id', (group, pickup) => {
      group.position.set(laneToX(pickup.lane), 0.55 + Math.sin(clockTime * 3 + group.userData.spinSeed) * 0.1, pickup.z);
      group.rotation.y += dt * 2.4;
    });

    if (camera) {
      const targetX = carX * 0.7;
      camera.position.x += (targetX - camera.position.x) * Math.min(1, 6 * dt);
      camera.position.y = 4.2 + (state.isBoosting ? Math.sin(clockTime * 30) * 0.05 : 0);
      camera.lookAt(targetX, 1, 14);
    }
  }

  function dispose(scene) {
    deactivate(scene || { remove: () => {} });
    disposeObject(roadGroup);
    disposeObject(carGroup);
    roadGroup = null;
    carGroup = null;
    initialized = false;
  }

  window.RacerRender = { init, activate, deactivate, update, dispose, laneToX };
})();
