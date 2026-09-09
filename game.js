// ==========================================================================
// 3D Neon Snake Arcade - WebGL 3D Game Controller (Three.js + SnakeEngine)
// High Performance, Memory-Managed & E2E-Tested Architecture
// ==========================================================================

(function () {
  'use strict';

  if (typeof THREE === 'undefined') {
    console.error('Three.js failed to load. Falling back or check network.');
    return;
  }
  if (typeof SnakeEngine === 'undefined') {
    console.error('SnakeEngine failed to load. Ensure engine.js is included.');
    return;
  }

  // DOM Elements
  const container = document.getElementById('webglContainer');
  const scoreVal = document.getElementById('score');
  const highScoreVal = document.getElementById('highScore');
  const startOverlay = document.getElementById('startOverlay');
  const freezeIndicator = document.getElementById('freezeIndicator');
  const pauseOverlay = document.getElementById('pauseOverlay');
  const gameOverModal = document.getElementById('gameOver');
  const finalScoreEl = document.getElementById('finalScore');
  const newBestTag = document.getElementById('newBestTag');
  const restartBtn = document.getElementById('restartBtn');
  const resumeBtn = document.getElementById('resumeBtn');
  const muteBtn = document.getElementById('muteBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const cameraBtn = document.getElementById('cameraBtn');
  const modeBtn = document.getElementById('modeBtn');
  const currentModeLabel = document.getElementById('currentModeLabel');
  const modeModal = document.getElementById('modeModal');
  const closeModeModalBtn = document.getElementById('closeModeModalBtn');
  const modeCards = document.querySelectorAll('.mode-card');
  const diffButtons = document.querySelectorAll('.diff-btn:not(.mode-selector-btn)');
  const dpadButtons = document.querySelectorAll('.dpad-btn');

  // Audio Synthesizer (Web Audio API)
  const SoundFX = (function () {
    let audioCtx = null;
    let isMuted = localStorage.getItem('snake_3d_muted') === 'true';

    function getContext() {
      if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) audioCtx = new AudioContext();
      }
      if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      return audioCtx;
    }

    function playTone(freq, type, duration, gainVal = 0.15) {
      if (isMuted) return;
      try {
        const ctx = getContext();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(gainVal, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch (e) {}
    }

    return {
      isMuted: () => isMuted,
      ensureContext: getContext,
      toggleMute: function () {
        isMuted = !isMuted;
        localStorage.setItem('snake_3d_muted', isMuted);
        return isMuted;
      },
      eat: function () {
        playTone(520, 'square', 0.08, 0.15);
        setTimeout(() => playTone(780, 'square', 0.1, 0.15), 60);
      },
      golden: function () {
        [587, 740, 880, 1174].forEach((f, i) => {
          setTimeout(() => playTone(f, 'triangle', 0.14, 0.2), i * 50);
        });
      },
      freeze: function () {
        playTone(880, 'sine', 0.25, 0.2);
        setTimeout(() => playTone(440, 'sine', 0.3, 0.2), 100);
      },
      warp: function () {
        playTone(330, 'sine', 0.15, 0.18);
        setTimeout(() => playTone(660, 'sine', 0.2, 0.2), 60);
      },
      hazardCrash: function () {
        playTone(150, 'sawtooth', 0.45, 0.35);
        setTimeout(() => playTone(80, 'sawtooth', 0.35, 0.3), 90);
      },
      crash: function () {
        if (isMuted) return;
        try {
          const ctx = getContext();
          if (!ctx) return;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(220, ctx.currentTime);
          osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.4);
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.4);
        } catch (e) {}
      }
    };
  })();

  // --------------------------------------------------------------------------
  // Three.js 3D Setup & Memory-Managed Geometries
  // --------------------------------------------------------------------------
  const GRID_SIZE = 20;
  const CELL_SIZE = 1.0;
  const HALF_GRID = (GRID_SIZE * CELL_SIZE) / 2;

  let scene, camera, renderer;
  let snakeHeadLight;
  let snakeMeshes = [];
  let foodMesh = null;
  let particles = [];
  let cameraMode = 'isometric'; // 'isometric' | 'follow'
  let currentMode = 'classic';
  let arenaGroup = null;
  let obstacleMeshes = [];

  const THEMES = {
    classic: {
      bg: 0x060814,
      gridCenter: 0x00ffaa,
      gridLines: 0x142044,
      wallColor: 0x00ffff,
      headColor: 0x00ff88,
      bodyColor: 0x00cc66,
      lightColor: 0x00ff88
    },
    portal: {
      bg: 0x0e051c,
      gridCenter: 0xbf55ec,
      gridLines: 0x2e0854,
      wallColor: 0xda70d6,
      headColor: 0xe879f9,
      bodyColor: 0xa855f7,
      lightColor: 0xd946ef
    },
    labyrinth: {
      bg: 0x140702,
      gridCenter: 0xff6600,
      gridLines: 0x3d1402,
      wallColor: 0xff3300,
      headColor: 0xfbbf24,
      bodyColor: 0xd97706,
      lightColor: 0xff7700
    },
    hyper: {
      bg: 0x020d1a,
      gridCenter: 0x00e5ff,
      gridLines: 0x052e4f,
      wallColor: 0xff0077,
      headColor: 0x00e5ff,
      bodyColor: 0x0284c7,
      lightColor: 0x00e5ff
    }
  };

  // Pre-allocated Shared Geometries & Materials (Memory Leak Prevention)
  const bodyGeo = new THREE.BoxGeometry(0.85, 0.75, 0.85);
  const headGeo = new THREE.BoxGeometry(0.9, 0.82, 0.9);
  const eyeGeo = new THREE.SphereGeometry(0.12, 10, 10);
  const pupilGeo = new THREE.SphereGeometry(0.06, 8, 8);
  const particleGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
  const obstacleGeo = new THREE.BoxGeometry(0.88, 1.2, 0.88);

  const obstacleMat = new THREE.MeshStandardMaterial({
    color: 0x14121e,
    emissive: 0xff3300,
    emissiveIntensity: 0.55,
    roughness: 0.15,
    metalness: 0.85
  });

  const headMat = new THREE.MeshStandardMaterial({
    color: 0x00ff88,
    emissive: 0x00ff88,
    emissiveIntensity: 0.35,
    roughness: 0.25,
    metalness: 0.4
  });

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x00cc66,
    emissive: 0x004422,
    emissiveIntensity: 0.2,
    roughness: 0.3,
    metalness: 0.3
  });

  const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const pupilMat = new THREE.MeshBasicMaterial({ color: 0x000000 });

  // Shared Food Geometries and Materials
  const appleGeo = new THREE.SphereGeometry(0.42, 16, 16);
  const appleMat = new THREE.MeshStandardMaterial({
    color: 0xff2d55,
    emissive: 0xcc0033,
    emissiveIntensity: 0.4,
    roughness: 0.3,
    metalness: 0.2
  });

  const goldenGeo = new THREE.OctahedronGeometry(0.5, 0);
  const goldenMat = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xffaa00,
    emissiveIntensity: 0.6,
    roughness: 0.1,
    metalness: 0.9
  });

  const freezeGeo = new THREE.BoxGeometry(0.7, 0.7, 0.7);
  const freezeMat = new THREE.MeshStandardMaterial({
    color: 0x00bfff,
    emissive: 0x0099ff,
    emissiveIntensity: 0.5,
    roughness: 0.2,
    metalness: 0.3
  });

  // Particle Material Cache
  const particleMatCache = {
    golden: new THREE.MeshBasicMaterial({ color: 0xffd700 }),
    freeze: new THREE.MeshBasicMaterial({ color: 0x00bfff }),
    normal: new THREE.MeshBasicMaterial({ color: 0xff2d55 }),
    warp: new THREE.MeshBasicMaterial({ color: 0xbf55ec })
  };

  // Flag all shared singletons to prevent accidental GPU disposal
  [
    bodyGeo, headGeo, eyeGeo, pupilGeo, particleGeo, obstacleGeo,
    appleGeo, goldenGeo, freezeGeo
  ].forEach(g => { g.userData = g.userData || {}; g.userData.isShared = true; });

  [
    obstacleMat, headMat, bodyMat, eyeWhiteMat, pupilMat,
    appleMat, goldenMat, freezeMat,
    particleMatCache.golden, particleMatCache.freeze, particleMatCache.normal, particleMatCache.warp
  ].forEach(m => { m.userData = m.userData || {}; m.userData.isShared = true; });

  function initThree() {
    const width = container.clientWidth || 400;
    const height = container.clientHeight || 400;

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060814);
    scene.fog = new THREE.FogExp2(0x060814, 0.025);

    camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    setCameraView('isometric');

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0x404868, 1.2);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    sunLight.position.set(15, 25, 20);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 60;
    sunLight.shadow.camera.left = -15;
    sunLight.shadow.camera.right = 15;
    sunLight.shadow.camera.top = 15;
    sunLight.shadow.camera.bottom = -15;
    scene.add(sunLight);

    snakeHeadLight = new THREE.PointLight(0x00ff88, 2.5, 9);
    snakeHeadLight.position.set(0, 1.5, 0);
    scene.add(snakeHeadLight);

    createArena();
    window.addEventListener('resize', onWindowResize);
  }

  function setCameraView(mode) {
    cameraMode = mode;
    if (mode === 'isometric') {
      camera.position.set(0, 21, 19);
      camera.lookAt(0, -0.5, 0);
    } else {
      camera.position.set(0, 15, 14);
      camera.lookAt(0, 0, 0);
    }
  }

  function applyModeTheme(mode) {
    const t = THEMES[mode] || THEMES.classic;
    if (scene) {
      scene.background.setHex(t.bg);
      if (scene.fog) scene.fog.color.setHex(t.bg);
    }
    if (snakeHeadLight) {
      snakeHeadLight.color.setHex(t.lightColor);
    }
    headMat.color.setHex(t.headColor);
    headMat.emissive.setHex(t.headColor);
    bodyMat.color.setHex(t.bodyColor);
    createArena(mode);
  }

  function createArena(mode = currentMode) {
    if (arenaGroup) {
      scene.remove(arenaGroup);
      arenaGroup.traverse(child => {
        if (child.isMesh || child.isLineSegments) disposeMesh(child);
      });
    }

    arenaGroup = new THREE.Group();
    const t = THEMES[mode] || THEMES.classic;

    const floorGeo = new THREE.BoxGeometry(GRID_SIZE * CELL_SIZE, 0.4, GRID_SIZE * CELL_SIZE);
    const floorMat = new THREE.MeshStandardMaterial({
      color: t.bg,
      roughness: 0.6,
      metalness: 0.3
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.y = -0.2;
    floorMesh.receiveShadow = true;
    arenaGroup.add(floorMesh);

    const gridHelper = new THREE.GridHelper(GRID_SIZE * CELL_SIZE, GRID_SIZE, t.gridCenter, t.gridLines);
    gridHelper.position.y = 0.01;
    arenaGroup.add(gridHelper);

    const wallThick = 0.3;
    const wallHeight = 0.6;
    const size = GRID_SIZE * CELL_SIZE;

    if (mode === 'portal') {
      // Portal beacons at the 4 corners
      const portalBeaconMat = new THREE.MeshStandardMaterial({
        color: t.wallColor,
        emissive: t.wallColor,
        emissiveIntensity: 0.65,
        transparent: true,
        opacity: 0.6,
        roughness: 0.1
      });
      const bSize = 1.4;
      const bGeo = new THREE.BoxGeometry(bSize, wallHeight * 1.8, bSize);
      const corners = [
        [-size / 2, -size / 2],
        [size / 2, -size / 2],
        [-size / 2, size / 2],
        [size / 2, size / 2]
      ];
      corners.forEach(([cx, cz]) => {
        const beacon = new THREE.Mesh(bGeo, portalBeaconMat);
        beacon.position.set(cx, (wallHeight * 1.8) / 2, cz);
        arenaGroup.add(beacon);
      });
    } else {
      const wallMat = new THREE.MeshStandardMaterial({
        color: t.wallColor,
        emissive: t.wallColor,
        emissiveIntensity: 0.35,
        roughness: 0.2
      });

      const northWall = new THREE.Mesh(new THREE.BoxGeometry(size + wallThick * 2, wallHeight, wallThick), wallMat);
      northWall.position.set(0, wallHeight / 2, -size / 2 - wallThick / 2);
      arenaGroup.add(northWall);

      const southWall = new THREE.Mesh(new THREE.BoxGeometry(size + wallThick * 2, wallHeight, wallThick), wallMat);
      southWall.position.set(0, wallHeight / 2, size / 2 + wallThick / 2);
      arenaGroup.add(southWall);

      const westWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallHeight, size), wallMat);
      westWall.position.set(-size / 2 - wallThick / 2, wallHeight / 2, 0);
      arenaGroup.add(westWall);

      const eastWall = new THREE.Mesh(new THREE.BoxGeometry(wallThick, wallHeight, size), wallMat);
      eastWall.position.set(size / 2 + wallThick / 2, wallHeight / 2, 0);
      arenaGroup.add(eastWall);
    }

    scene.add(arenaGroup);
  }

  function onWindowResize() {
    if (!renderer || !container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  function gridToWorld(gx, gy) {
    const wx = (gx + 0.5) * CELL_SIZE - HALF_GRID;
    const wz = (gy + 0.5) * CELL_SIZE - HALF_GRID;
    return { x: wx, z: wz };
  }

  function createSnakeSegment(isHead = false) {
    const mesh = new THREE.Mesh(isHead ? headGeo : bodyGeo, isHead ? headMat : bodyMat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.y = 0.4;

    if (isHead) {
      const leftEye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
      leftEye.position.set(-0.25, 0.25, 0.38);
      const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
      leftPupil.position.set(0, 0, 0.08);
      leftEye.add(leftPupil);
      mesh.add(leftEye);

      const rightEye = new THREE.Mesh(eyeGeo, eyeWhiteMat);
      rightEye.position.set(0.25, 0.25, 0.38);
      const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
      rightPupil.position.set(0, 0, 0.08);
      rightEye.add(rightPupil);
      mesh.add(rightEye);
    }

    scene.add(mesh);
    return mesh;
  }

  // WebGL Resource Cleanup helper to avoid memory leaks
  function disposeMesh(mesh) {
    if (!mesh) return;
    if (mesh.geometry && !mesh.geometry.userData?.isShared) {
      mesh.geometry.dispose();
    }
    if (mesh.material && !mesh.material.userData?.isShared) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(m => m.dispose());
      } else {
        mesh.material.dispose();
      }
    }
  }

  function updateSnake3D(snakeArray, direction) {
    while (snakeMeshes.length < snakeArray.length) {
      const isHead = snakeMeshes.length === 0;
      snakeMeshes.push(createSnakeSegment(isHead));
    }
    while (snakeMeshes.length > snakeArray.length) {
      const oldMesh = snakeMeshes.pop();
      scene.remove(oldMesh);
      disposeMesh(oldMesh);
    }

    for (let i = 0; i < snakeArray.length; i++) {
      const seg = snakeArray[i];
      const pos = gridToWorld(seg.x, seg.y);
      const mesh = snakeMeshes[i];
      mesh.position.x = pos.x;
      mesh.position.z = pos.z;

      if (i === 0) {
        let angle = 0;
        if (direction.x === 1) angle = Math.PI / 2;
        else if (direction.x === -1) angle = -Math.PI / 2;
        else if (direction.y === 1) angle = Math.PI;
        else if (direction.y === -1) angle = 0;
        mesh.rotation.y = angle;

        snakeHeadLight.position.set(pos.x, 1.2, pos.z);
      }
    }
  }

  function spawnFood3D(food) {
    if (foodMesh) {
      scene.remove(foodMesh);
      foodMesh = null;
    }
    if (!food) return;

    let geo, mat;
    if (food.type === 'golden') {
      geo = goldenGeo;
      mat = goldenMat;
    } else if (food.type === 'freeze') {
      geo = freezeGeo;
      mat = freezeMat;
    } else {
      geo = appleGeo;
      mat = appleMat;
    }

    foodMesh = new THREE.Mesh(geo, mat);
    foodMesh.castShadow = true;
    const pos = gridToWorld(food.x, food.y);
    foodMesh.position.set(pos.x, 0.45, pos.z);
    scene.add(foodMesh);
  }

  function create3DParticles(x, z, type = 'normal', count = 20) {
    const mat = particleMatCache[type] || particleMatCache.normal;

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(particleGeo, mat);
      mesh.position.set(x, 0.4, z);
      const angle = Math.random() * Math.PI * 2;
      const speed = 1.5 + Math.random() * 3.5;
      const velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        2.5 + Math.random() * 4.0,
        Math.sin(angle) * speed
      );
      scene.add(mesh);
      particles.push({ mesh, velocity, life: 1.0 });
    }
  }

  function updateParticles(delta) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= delta * 2.0;
      if (p.life <= 0) {
        scene.remove(p.mesh);
        particles.splice(i, 1);
        continue;
      }
      p.velocity.y -= 9.8 * delta;
      p.mesh.position.addScaledVector(p.velocity, delta);
      p.mesh.scale.setScalar(p.life);
      p.mesh.rotation.x += 0.1;
      p.mesh.rotation.y += 0.15;
    }
  }

  // --------------------------------------------------------------------------
  // Game State & Loop
  // --------------------------------------------------------------------------
  let gameState = null;
  let isGameStarted = false;
  let lastTickTime = 0;
  let animationFrameId = null;
  let lastFrameTime = performance.now();

  const SPEEDS = {
    easy: 150,
    normal: 105,
    blitz: 70
  };
  let currentDifficulty = 'normal';

  function setMode(mode) {
    if (!SnakeEngine.MODES[mode.toUpperCase()]) return;
    currentMode = mode;
    if (currentModeLabel) {
      currentModeLabel.textContent = SnakeEngine.MODE_CONFIGS[mode].name.split(' ')[0];
    }
    modeCards.forEach(card => {
      card.classList.toggle('active', card.dataset.mode === mode);
    });
    applyModeTheme(mode);
    initGame();
  }

  function toggleModeModal(open) {
    if (!modeModal) return;
    const shouldOpen = open !== undefined ? open : modeModal.hidden;
    modeModal.hidden = !shouldOpen;
    if (shouldOpen && isGameStarted && gameState && !gameState.isPaused && !gameState.isGameOver) {
      togglePause();
    }
  }

  function initGame() {
    isGameStarted = false;
    const modeKey = 'snake_3d_high_score_' + currentMode;
    const savedHighScore = parseInt(localStorage.getItem(modeKey) || '0', 10);
    highScoreVal.textContent = savedHighScore;

    gameState = SnakeEngine.createGameState({
      width: GRID_SIZE,
      height: GRID_SIZE,
      mode: currentMode,
      highScore: savedHighScore,
      difficulty: currentDifficulty,
      baseSpeed: SPEEDS[currentDifficulty]
    });

    // Clear meshes safely
    snakeMeshes.forEach(m => scene.remove(m));
    snakeMeshes = [];
    if (foodMesh) { scene.remove(foodMesh); foodMesh = null; }
    particles.forEach(p => scene.remove(p.mesh));
    particles = [];
    obstacleMeshes.forEach(m => { scene.remove(m); disposeMesh(m); });
    obstacleMeshes = [];

    // Create obstacle meshes if labyrinth mode
    if (gameState.obstacles && gameState.obstacles.length > 0) {
      gameState.obstacles.forEach(obs => {
        const mesh = new THREE.Mesh(obstacleGeo, obstacleMat);
        const wPos = gridToWorld(obs.x, obs.y);
        mesh.position.set(wPos.x, 0.6, wPos.z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        scene.add(mesh);
        obstacleMeshes.push(mesh);
      });
    }

    // Refresh best scores in mode cards
    ['classic', 'portal', 'labyrinth', 'hyper'].forEach(m => {
      const el = document.getElementById('best' + m.charAt(0).toUpperCase() + m.slice(1));
      if (el) {
        el.textContent = localStorage.getItem('snake_3d_high_score_' + m) || '0';
      }
    });

    updateScoreDisplay();
    updateSnake3D(gameState.snake, gameState.direction);
    spawnFood3D(gameState.food);

    gameOverModal.hidden = true;
    if (modeModal) modeModal.hidden = true;
    pauseOverlay.hidden = true;
    freezeIndicator.hidden = true;
    startOverlay.hidden = false;

    lastTickTime = performance.now();
    lastFrameTime = performance.now();
  }

  function startGame() {
    if (!isGameStarted) {
      SoundFX.ensureContext();
      isGameStarted = true;
      startOverlay.hidden = true;
      lastTickTime = performance.now();
    }
  }

  function updateScoreDisplay() {
    scoreVal.textContent = gameState.score;
    highScoreVal.textContent = gameState.highScore;
  }

  function triggerGameOver(reason) {
    if (reason === 'obstacle_collision') {
      SoundFX.hazardCrash();
    } else {
      SoundFX.crash();
    }
    gameOverModal.hidden = false;
    finalScoreEl.textContent = gameState.score;

    const modeKey = 'snake_3d_high_score_' + currentMode;
    const previousBest = parseInt(localStorage.getItem(modeKey) || '0', 10);
    if (gameState.score > previousBest && gameState.score > 0) {
      newBestTag.hidden = false;
      localStorage.setItem(modeKey, gameState.score);
      const el = document.getElementById('best' + currentMode.charAt(0).toUpperCase() + currentMode.slice(1));
      if (el) el.textContent = gameState.score;
    } else {
      newBestTag.hidden = true;
    }
  }

  function gameLoop(now) {
    animationFrameId = requestAnimationFrame(gameLoop);

    const delta = (now - lastFrameTime) / 1000;
    lastFrameTime = now;

    if (foodMesh) {
      foodMesh.rotation.y += 2.0 * delta;
      foodMesh.rotation.x += 0.8 * delta;
      foodMesh.position.y = 0.45 + Math.sin(now * 0.005) * 0.12;
    }

    updateParticles(delta);

    if (cameraMode === 'follow' && gameState && gameState.snake.length > 0) {
      const head = gridToWorld(gameState.snake[0].x, gameState.snake[0].y);
      camera.position.x += (head.x - camera.position.x) * 0.05;
      camera.position.z += (head.z + 14 - camera.position.z) * 0.05;
      camera.lookAt(head.x, 0, head.z);
    }

    if (isGameStarted && gameState && !gameState.isPaused && !gameState.isGameOver) {
      const elapsed = now - lastTickTime;
      if (elapsed >= gameState.currentSpeed) {
        lastTickTime = now;
        const tickResult = SnakeEngine.tick(gameState, now);

        if (tickResult.gameOver) {
          triggerGameOver(tickResult.reason);
        } else if (tickResult.moved) {
          updateSnake3D(gameState.snake, gameState.direction);

          if (tickResult.didWarp) {
            SoundFX.warp();
            const headPos = gridToWorld(gameState.snake[0].x, gameState.snake[0].y);
            create3DParticles(headPos.x, headPos.z, 'warp', 16);
          }

          if (tickResult.ateFood) {
            updateScoreDisplay();
            const food = tickResult.foodEaten;
            const wPos = gridToWorld(food.x, food.y);

            if (food.type === 'golden') {
              SoundFX.golden();
              create3DParticles(wPos.x, wPos.z, 'golden', 30);
            } else if (food.type === 'freeze') {
              SoundFX.freeze();
              create3DParticles(wPos.x, wPos.z, 'freeze', 25);
            } else {
              SoundFX.eat();
              create3DParticles(wPos.x, wPos.z, 'normal', 18);
            }

            spawnFood3D(gameState.food);
          }
        }

        freezeIndicator.hidden = !gameState.activeEffect;
      }
    }

    renderer.render(scene, camera);
  }

  // --------------------------------------------------------------------------
  // Controls & Button Handlers
  // --------------------------------------------------------------------------
  function setDifficulty(diff) {
    if (!SPEEDS[diff]) return;
    currentDifficulty = diff;
    diffButtons.forEach(b => {
      b.classList.toggle('active', b.dataset.difficulty === diff);
    });
    if (gameState && !gameState.isGameOver) {
      gameState.difficulty = diff;
      gameState.baseSpeed = SPEEDS[diff];
      if (!gameState.activeEffect) {
        gameState.currentSpeed = SPEEDS[diff];
      }
    }
  }

  function togglePause() {
    if (!gameState || gameState.isGameOver || !isGameStarted) return;
    gameState.isPaused = !gameState.isPaused;
    pauseOverlay.hidden = !gameState.isPaused;
    pauseBtn.setAttribute('aria-pressed', String(gameState.isPaused));
    pauseBtn.querySelector('.icon-pause').hidden = gameState.isPaused;
    pauseBtn.querySelector('.icon-play').hidden = !gameState.isPaused;
  }

  function handleDirectionInput(dirStr) {
    if (!gameState || gameState.isPaused || gameState.isGameOver) return;
    startGame();

    const dirMap = {
      up: SnakeEngine.DIRECTIONS.UP,
      down: SnakeEngine.DIRECTIONS.DOWN,
      left: SnakeEngine.DIRECTIONS.LEFT,
      right: SnakeEngine.DIRECTIONS.RIGHT
    };
    if (dirMap[dirStr]) {
      SnakeEngine.changeDirection(gameState, dirMap[dirStr]);
    }
  }

  function initControls() {
    startOverlay.addEventListener('click', () => {
      startGame();
    });

    diffButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        setDifficulty(btn.dataset.difficulty);
      });
    });

    muteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const muted = SoundFX.toggleMute();
      muteBtn.setAttribute('aria-pressed', String(muted));
      muteBtn.querySelector('.icon-on').hidden = muted;
      muteBtn.querySelector('.icon-off').hidden = !muted;
    });
    const isMutedInitial = SoundFX.isMuted();
    muteBtn.setAttribute('aria-pressed', String(isMutedInitial));
    muteBtn.querySelector('.icon-on').hidden = isMutedInitial;
    muteBtn.querySelector('.icon-off').hidden = !isMutedInitial;

    pauseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      togglePause();
    });
    resumeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      togglePause();
    });

    if (modeBtn) {
      modeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleModeModal();
      });
    }

    if (closeModeModalBtn) {
      closeModeModalBtn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleModeModal(false);
        startGame();
      });
    }

    modeCards.forEach(card => {
      card.addEventListener('click', (e) => {
        e.preventDefault();
        const mode = card.dataset.mode;
        if (mode) {
          setMode(mode);
          toggleModeModal(false);
          startGame();
        }
      });
    });

    cameraBtn.addEventListener('click', (e) => {
      e.preventDefault();
      setCameraView(cameraMode === 'isometric' ? 'follow' : 'isometric');
    });

    restartBtn.addEventListener('click', (e) => {
      e.preventDefault();
      initGame();
    });

    dpadButtons.forEach(btn => {
      const dir = btn.dataset.dir;
      if (!dir) return;

      const trigger = (e) => {
        e.preventDefault();
        btn.classList.add('pressed');
        handleDirectionInput(dir);
        setTimeout(() => btn.classList.remove('pressed'), 120);
      };

      btn.addEventListener('pointerdown', trigger);
    });

    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          handleDirectionInput('up');
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          handleDirectionInput('down');
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          handleDirectionInput('left');
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          handleDirectionInput('right');
          break;
        case ' ':
        case 'p':
        case 'P':
          togglePause();
          break;
        case 'l':
        case 'L':
          toggleModeModal();
          break;
        case 'r':
        case 'R':
          if (gameState && gameState.isGameOver) {
            initGame();
          }
          break;
        case 'm':
        case 'M':
          muteBtn.click();
          break;
        case 'c':
        case 'C':
          cameraBtn.click();
          break;
      }
    });
  }

  function start() {
    initThree();
    initControls();
    initGame();
    animationFrameId = requestAnimationFrame(gameLoop);
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    start();
  } else {
    window.addEventListener('DOMContentLoaded', start);
  }
})();
