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
  const diffButtons = document.querySelectorAll('.diff-btn');
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

  // Pre-allocated Shared Geometries & Materials (Memory Leak Prevention)
  const bodyGeo = new THREE.BoxGeometry(0.85, 0.75, 0.85);
  const headGeo = new THREE.BoxGeometry(0.9, 0.82, 0.9);
  const eyeGeo = new THREE.SphereGeometry(0.12, 10, 10);
  const pupilGeo = new THREE.SphereGeometry(0.06, 8, 8);
  const particleGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);

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
    normal: new THREE.MeshBasicMaterial({ color: 0xff2d55 })
  };

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

  function createArena() {
    const arenaGroup = new THREE.Group();

    const floorGeo = new THREE.BoxGeometry(GRID_SIZE * CELL_SIZE, 0.4, GRID_SIZE * CELL_SIZE);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0a0e24,
      roughness: 0.6,
      metalness: 0.3
    });
    const floorMesh = new THREE.Mesh(floorGeo, floorMat);
    floorMesh.position.y = -0.2;
    floorMesh.receiveShadow = true;
    arenaGroup.add(floorMesh);

    const gridHelper = new THREE.GridHelper(GRID_SIZE * CELL_SIZE, GRID_SIZE, 0x00ffaa, 0x142044);
    gridHelper.position.y = 0.01;
    arenaGroup.add(gridHelper);

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00ffff,
      emissiveIntensity: 0.3,
      roughness: 0.2
    });
    const wallThick = 0.3;
    const wallHeight = 0.6;
    const size = GRID_SIZE * CELL_SIZE;

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

  function updateSnake3D(snakeArray, direction) {
    while (snakeMeshes.length < snakeArray.length) {
      const isHead = snakeMeshes.length === 0;
      snakeMeshes.push(createSnakeSegment(isHead));
    }
    while (snakeMeshes.length > snakeArray.length) {
      const oldMesh = snakeMeshes.pop();
      scene.remove(oldMesh);
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

  function initGame() {
    isGameStarted = false;
    const savedHighScore = parseInt(localStorage.getItem('snake_3d_high_score') || '0', 10);
    highScoreVal.textContent = savedHighScore;

    gameState = SnakeEngine.createGameState({
      width: GRID_SIZE,
      height: GRID_SIZE,
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

    updateScoreDisplay();
    updateSnake3D(gameState.snake, gameState.direction);
    spawnFood3D(gameState.food);

    gameOverModal.hidden = true;
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

  function triggerGameOver() {
    SoundFX.crash();
    gameOverModal.hidden = false;
    finalScoreEl.textContent = gameState.score;

    const previousBest = parseInt(localStorage.getItem('snake_3d_high_score') || '0', 10);
    if (gameState.score > previousBest && gameState.score > 0) {
      newBestTag.hidden = false;
      localStorage.setItem('snake_3d_high_score', gameState.score);
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
          triggerGameOver();
        } else if (tickResult.moved) {
          updateSnake3D(gameState.snake, gameState.direction);

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
