// Snake Game — presentation layer (rendering, input, audio, FX)
// Game rules/state live in engine.js (window.SnakeEngine); this file just drives it.

(function () {
  'use strict';

  const Engine = window.SnakeEngine;
  const DIRECTIONS = Engine.DIRECTIONS;

  // ---------------------------------------------------------------------
  // DOM references
  // ---------------------------------------------------------------------
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');

  const scoreEl = document.getElementById('score').querySelector('.badge-value');
  const highScoreEl = document.getElementById('highScore');
  const gameOverOverlay = document.getElementById('gameOver');
  const finalScoreEl = document.getElementById('finalScore');
  const newBestTag = document.getElementById('newBestTag');
  const restartBtn = document.getElementById('restartBtn');
  const muteBtn = document.getElementById('muteBtn');
  const pauseBtn = document.getElementById('pauseBtn');
  const pauseOverlay = document.getElementById('pauseOverlay');
  const freezeIndicator = document.getElementById('freezeIndicator');
  const diffButtons = Array.from(document.querySelectorAll('.diff-btn'));
  const dpadButtons = Array.from(document.querySelectorAll('.dpad-btn[data-dir]'));

  // ---------------------------------------------------------------------
  // Grid / rendering configuration
  // ---------------------------------------------------------------------
  const GRID_SIZE = 20;
  const TILE_SIZE = canvas.width / GRID_SIZE;

  const DIFFICULTY_SPEEDS = {
    easy: 145,
    normal: 105,
    blitz: 68
  };

  const HIGH_SCORE_KEY = 'neonSnake.highScore';
  const MUTE_KEY = 'neonSnake.muted';

  // ---------------------------------------------------------------------
  // Audio — lightweight Web Audio API synth (no external assets)
  // ---------------------------------------------------------------------
  const Audio = (function () {
    let ctxAudio = null;
    let masterGain = null;
    let muted = localStorage.getItem(MUTE_KEY) === 'true';

    function ensureContext() {
      if (!ctxAudio) {
        const AC = window.AudioContext || window.webkitAudioContext;
        ctxAudio = new AC();
        masterGain = ctxAudio.createGain();
        masterGain.gain.value = muted ? 0 : 0.45;
        masterGain.connect(ctxAudio.destination);
      }
      if (ctxAudio.state === 'suspended') {
        ctxAudio.resume();
      }
      return ctxAudio;
    }

    function setMuted(next) {
      muted = next;
      localStorage.setItem(MUTE_KEY, String(muted));
      if (masterGain && ctxAudio) {
        masterGain.gain.setTargetAtTime(muted ? 0 : 0.45, ctxAudio.currentTime, 0.01);
      }
    }

    function toggleMute() {
      setMuted(!muted);
      return muted;
    }

    function tone({ freq, type = 'sine', duration = 0.15, gain = 0.3, freqEnd = null, delay = 0 }) {
      const ac = ensureContext();
      const t0 = ac.currentTime + delay;
      const osc = ac.createOscillator();
      const g = ac.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (freqEnd !== null) {
        osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), t0 + duration);
      }

      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

      osc.connect(g).connect(masterGain);
      osc.start(t0);
      osc.stop(t0 + duration + 0.03);
    }

    function playEat() {
      tone({ freq: 620, type: 'triangle', duration: 0.09, gain: 0.28, freqEnd: 980 });
    }

    function playGolden() {
      [880, 1108, 1318, 1568].forEach((f, i) =>
        tone({ freq: f, type: 'sine', duration: 0.18, gain: 0.22, delay: i * 0.06 })
      );
    }

    function playFreeze() {
      tone({ freq: 1400, type: 'sawtooth', duration: 0.4, gain: 0.15, freqEnd: 140 });
      tone({ freq: 900, type: 'sine', duration: 0.45, gain: 0.1, freqEnd: 100, delay: 0.03 });
    }

    function playCrash() {
      [110, 116.5, 155.6].forEach((f) => tone({ freq: f, type: 'square', duration: 0.45, gain: 0.2 }));

      const ac = ensureContext();
      const bufferSize = Math.floor(ac.sampleRate * 0.35);
      const buffer = ac.createBuffer(1, bufferSize, ac.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }
      const noise = ac.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = ac.createGain();
      noiseGain.gain.value = 0.18;
      noise.connect(noiseGain).connect(masterGain);
      noise.start();
    }

    return {
      ensureContext,
      toggleMute,
      isMuted: () => muted,
      playEat,
      playGolden,
      playFreeze,
      playCrash
    };
  })();

  // ---------------------------------------------------------------------
  // Particle burst FX
  // ---------------------------------------------------------------------
  let particles = [];

  function spawnParticles(cx, cy, color, count = 16) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 3.2;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.025 + Math.random() * 0.025,
        size: 1.5 + Math.random() * 2.5,
        color
      });
    }
  }

  function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.life -= p.decay;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function drawParticles() {
    particles.forEach((p) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  // ---------------------------------------------------------------------
  // High score persistence
  // ---------------------------------------------------------------------
  function loadHighScore() {
    const raw = localStorage.getItem(HIGH_SCORE_KEY);
    const parsed = parseInt(raw, 10);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function saveHighScore(value) {
    localStorage.setItem(HIGH_SCORE_KEY, String(value));
  }

  // ---------------------------------------------------------------------
  // Game state
  // ---------------------------------------------------------------------
  let difficulty = 'normal';
  let state = null;
  let lastTickTime = 0;
  let animationFrameId = null;

  function initGame() {
    const highScore = loadHighScore();
    state = Engine.createGameState({
      width: GRID_SIZE,
      height: GRID_SIZE,
      highScore,
      difficulty,
      baseSpeed: DIFFICULTY_SPEEDS[difficulty]
    });
    particles = [];

    updateHud();
    hideGameOver();
    setPaused(false);
    freezeIndicator.hidden = true;

    lastTickTime = performance.now();
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    animationFrameId = requestAnimationFrame(gameLoop);
  }

  function updateHud() {
    scoreEl.textContent = state.score;
    highScoreEl.textContent = state.highScore;
  }

  // ---------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------
  function drawGrid() {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.025)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= canvas.width; i += TILE_SIZE) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }
  }

  function drawFood() {
    const food = state.food;
    if (!food) return;

    const cx = food.x * TILE_SIZE + TILE_SIZE / 2;
    const cy = food.y * TILE_SIZE + TILE_SIZE / 2;
    const radius = TILE_SIZE / 2 - 2;
    const pulse = 1 + Math.sin(performance.now() / 180) * 0.08;

    ctx.save();
    ctx.shadowColor = food.color;
    ctx.shadowBlur = food.type === 'golden' ? 22 : 16;
    ctx.fillStyle = food.color;
    ctx.beginPath();
    ctx.arc(cx, cy, Math.max(2, radius * pulse), 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - radius * 0.3, cy - radius * 0.3, radius * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawRoundedRect(x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }

  // Cute directional eyes on the snake's head
  function drawEyes(x, y, size, direction) {
    const cx = x + size / 2;
    const cy = y + size / 2;
    const forward = size * 0.18;
    const spread = size * 0.22;
    const eyeRadius = Math.max(1.6, size * 0.15);
    const pupilRadius = eyeRadius * 0.5;

    let leftEye;
    let rightEye;

    if (direction.x === 1) {
      leftEye = { x: cx + forward, y: cy - spread };
      rightEye = { x: cx + forward, y: cy + spread };
    } else if (direction.x === -1) {
      leftEye = { x: cx - forward, y: cy - spread };
      rightEye = { x: cx - forward, y: cy + spread };
    } else if (direction.y === 1) {
      leftEye = { x: cx - spread, y: cy + forward };
      rightEye = { x: cx + spread, y: cy + forward };
    } else {
      leftEye = { x: cx - spread, y: cy - forward };
      rightEye = { x: cx + spread, y: cy - forward };
    }

    [leftEye, rightEye].forEach((eye) => {
      // White sclera
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(eye.x, eye.y, eyeRadius, 0, Math.PI * 2);
      ctx.fill();

      // Dark pupil, nudged slightly toward travel direction for a lively look
      ctx.fillStyle = '#05060a';
      ctx.beginPath();
      ctx.arc(eye.x + direction.x * pupilRadius * 0.4, eye.y + direction.y * pupilRadius * 0.4, pupilRadius, 0, Math.PI * 2);
      ctx.fill();

      // Tiny highlight for sparkle
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.arc(eye.x - pupilRadius * 0.4, eye.y - pupilRadius * 0.4, pupilRadius * 0.35, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawSnake() {
    const snake = state.snake;
    const isFrozen = Boolean(state.activeEffect && state.activeEffect.type === 'freeze');

    snake.forEach((segment, index) => {
      const x = segment.x * TILE_SIZE;
      const y = segment.y * TILE_SIZE;
      const size = TILE_SIZE - 2;
      const offset = 1;

      ctx.save();
      if (index === 0) {
        ctx.fillStyle = isFrozen ? '#8be9ff' : '#00f6ff';
        ctx.shadowColor = isFrozen ? '#8be9ff' : '#00f6ff';
        ctx.shadowBlur = 14;

        drawRoundedRect(x + offset, y + offset, size, size, 5);
        ctx.fill();
        ctx.shadowBlur = 0;

        drawEyes(x + offset, y + offset, size, state.direction);
      } else {
        const progress = index / snake.length;
        ctx.fillStyle = index % 2 === 0 ? '#00e1ff' : '#39ff88';
        ctx.shadowColor = '#00f6ff';
        ctx.shadowBlur = Math.max(0, 8 * (1 - progress));

        drawRoundedRect(x + offset, y + offset, size, size, 4);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    drawFood();
    drawSnake();
    drawParticles();
  }

  // ---------------------------------------------------------------------
  // Game loop
  // ---------------------------------------------------------------------
  function handleTickResult(result) {
    if (result.gameOver) {
      Audio.playCrash();
      triggerGameOver();
      return;
    }

    if (result.ateFood) {
      const food = result.foodEaten;
      const cx = result.head.x * TILE_SIZE + TILE_SIZE / 2;
      const cy = result.head.y * TILE_SIZE + TILE_SIZE / 2;

      spawnParticles(cx, cy, food.color, food.type === 'golden' ? 26 : 16);

      if (food.type === 'golden') {
        Audio.playGolden();
      } else if (food.type === 'freeze') {
        Audio.playFreeze();
      } else {
        Audio.playEat();
      }

      if (state.score > state.highScore) {
        state.highScore = state.score;
      }
      saveHighScore(state.highScore);
      updateHud();
    }

    freezeIndicator.hidden = !(state.activeEffect && state.activeEffect.type === 'freeze');
  }

  function gameLoop(timestamp) {
    if (state.isGameOver) return;

    if (!state.isPaused) {
      const elapsed = timestamp - lastTickTime;
      if (elapsed >= state.currentSpeed) {
        lastTickTime = timestamp - (elapsed % state.currentSpeed);
        const result = Engine.tick(state, Date.now());
        handleTickResult(result);
      }
      updateParticles();
    }

    draw();

    if (!state.isGameOver) {
      animationFrameId = requestAnimationFrame(gameLoop);
    }
  }

  // ---------------------------------------------------------------------
  // Pause / mute / game-over UI
  // ---------------------------------------------------------------------
  function setPaused(paused) {
    state.isPaused = paused;
    pauseBtn.setAttribute('aria-pressed', String(paused));
    pauseOverlay.hidden = !paused;
  }

  function togglePause() {
    if (state.isGameOver) return;
    Audio.ensureContext();
    setPaused(!state.isPaused);
  }

  function triggerGameOver() {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }

    finalScoreEl.textContent = state.score;
    newBestTag.hidden = !(state.score > 0 && state.score >= state.highScore);

    showGameOver();
  }

  function showGameOver() {
    gameOverOverlay.classList.add('visible');
  }

  function hideGameOver() {
    gameOverOverlay.classList.remove('visible', 'show');
  }

  function setDifficulty(next) {
    if (!DIFFICULTY_SPEEDS[next]) return;
    difficulty = next;

    diffButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.difficulty === difficulty);
    });

    initGame();
  }

  // ---------------------------------------------------------------------
  // Input handling
  // ---------------------------------------------------------------------
  function attemptDirectionChange(dir) {
    Audio.ensureContext();
    Engine.changeDirection(state, dir);
  }

  const KEY_DIRECTIONS = {
    ArrowUp: DIRECTIONS.UP,
    w: DIRECTIONS.UP,
    W: DIRECTIONS.UP,
    ArrowDown: DIRECTIONS.DOWN,
    s: DIRECTIONS.DOWN,
    S: DIRECTIONS.DOWN,
    ArrowLeft: DIRECTIONS.LEFT,
    a: DIRECTIONS.LEFT,
    A: DIRECTIONS.LEFT,
    ArrowRight: DIRECTIONS.RIGHT,
    d: DIRECTIONS.RIGHT,
    D: DIRECTIONS.RIGHT
  };

  window.addEventListener('keydown', (e) => {
    const key = e.key;

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(key)) {
      e.preventDefault();
    }

    if (state.isGameOver) {
      if (key === ' ' || key === 'Enter') {
        initGame();
      }
      return;
    }

    if (key === ' ') {
      togglePause();
      return;
    }

    const dir = KEY_DIRECTIONS[key];
    if (dir) {
      attemptDirectionChange(dir);
    }
  });

  dpadButtons.forEach((btn) => {
    const dir = DIRECTIONS[btn.dataset.dir.toUpperCase()];
    const activate = (e) => {
      e.preventDefault();
      if (state.isGameOver) return;
      attemptDirectionChange(dir);
    };
    btn.addEventListener('pointerdown', activate);
  });

  restartBtn.addEventListener('click', () => {
    Audio.ensureContext();
    initGame();
  });

  muteBtn.addEventListener('click', () => {
    const muted = Audio.toggleMute();
    muteBtn.setAttribute('aria-pressed', String(muted));
  });
  muteBtn.setAttribute('aria-pressed', String(Audio.isMuted()));

  pauseBtn.addEventListener('click', togglePause);

  diffButtons.forEach((btn) => {
    btn.addEventListener('click', () => setDifficulty(btn.dataset.difficulty));
  });

  // ---------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------
  function start() {
    const activeBtn = diffButtons.find((b) => b.classList.contains('active'));
    difficulty = activeBtn ? activeBtn.dataset.difficulty : 'normal';
    initGame();
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    start();
  } else {
    window.addEventListener('DOMContentLoaded', start);
  }
})();
