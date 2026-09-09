// Snake Game Logic

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');
const gameOverOverlay = document.getElementById('gameOver');
const finalScoreElement = document.getElementById('finalScore');
const restartBtn = document.getElementById('restartBtn');

// Grid Configuration
const GRID_SIZE = 20; // 20x20 grid
const TILE_SIZE = canvas.width / GRID_SIZE; // 400 / 20 = 20px

// Game State
let snake = [];
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let food = { x: 0, y: 0 };
let score = 0;
let isGameOver = false;

// Timing & Loop Control
let lastTickTime = 0;
const INITIAL_SPEED = 125; // milliseconds per movement step
let currentSpeed = INITIAL_SPEED;
let animationFrameId = null;

/**
 * Initialize / Reset game state
 */
function initGame() {
  // Start with 3 segments in the center moving right
  const startX = Math.floor(GRID_SIZE / 2);
  const startY = Math.floor(GRID_SIZE / 2);
  snake = [
    { x: startX, y: startY },
    { x: startX - 1, y: startY },
    { x: startX - 2, y: startY }
  ];

  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  score = 0;
  currentSpeed = INITIAL_SPEED;
  isGameOver = false;

  updateScoreDisplay();
  hideGameOver();
  spawnFood();

  lastTickTime = performance.now();
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
  }
  animationFrameId = requestAnimationFrame(gameLoop);
}

/**
 * Generate food at a random unoccupied grid coordinate
 */
function spawnFood() {
  const emptyCells = [];

  for (let x = 0; x < GRID_SIZE; x++) {
    for (let y = 0; y < GRID_SIZE; y++) {
      const isOccupied = snake.some(segment => segment.x === x && segment.y === y);
      if (!isOccupied) {
        emptyCells.push({ x, y });
      }
    }
  }

  if (emptyCells.length === 0) {
    // Player has filled the entire grid!
    triggerGameOver(true);
    return;
  }

  const randomIndex = Math.floor(Math.random() * emptyCells.length);
  food = emptyCells[randomIndex];
}

/**
 * Core update logic for each snake step
 */
function update() {
  if (isGameOver) return;

  // Apply buffered direction
  direction = { ...nextDirection };

  const newHead = {
    x: snake[0].x + direction.x,
    y: snake[0].y + direction.y
  };

  // Wall Collision Detection
  if (
    newHead.x < 0 ||
    newHead.x >= GRID_SIZE ||
    newHead.y < 0 ||
    newHead.y >= GRID_SIZE
  ) {
    triggerGameOver();
    return;
  }

  // Self Collision Detection
  for (let i = 0; i < snake.length; i++) {
    if (newHead.x === snake[i].x && newHead.y === snake[i].y) {
      triggerGameOver();
      return;
    }
  }

  // Add new head to snake
  snake.unshift(newHead);

  // Check if food eaten
  if (newHead.x === food.x && newHead.y === food.y) {
    score += 10;
    updateScoreDisplay();

    // Slightly increase speed as score increases (down to 65ms minimum)
    currentSpeed = Math.max(65, INITIAL_SPEED - Math.floor(score / 50) * 5);

    spawnFood();
  } else {
    // Remove tail segment if no food eaten
    snake.pop();
  }
}

/**
 * Render snake, food, and grid to the canvas
 */
function draw() {
  // Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Optional subtle background grid effect
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

  // Draw Food (glowing neon pink orb)
  const foodCenterX = food.x * TILE_SIZE + TILE_SIZE / 2;
  const foodCenterY = food.y * TILE_SIZE + TILE_SIZE / 2;
  const foodRadius = (TILE_SIZE / 2) - 2;

  ctx.save();
  ctx.shadowColor = '#ff2ee6';
  ctx.shadowBlur = 16;
  ctx.fillStyle = '#ff2ee6';
  ctx.beginPath();
  ctx.arc(foodCenterX, foodCenterY, Math.max(2, foodRadius), 0, Math.PI * 2);
  ctx.fill();

  // Food highlight
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(foodCenterX - foodRadius * 0.3, foodCenterY - foodRadius * 0.3, foodRadius * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Draw Snake
  snake.forEach((segment, index) => {
    const x = segment.x * TILE_SIZE;
    const y = segment.y * TILE_SIZE;
    const size = TILE_SIZE - 2; // slight gap between segments
    const offset = 1;

    ctx.save();
    if (index === 0) {
      // Head
      ctx.fillStyle = '#00f6ff';
      ctx.shadowColor = '#00f6ff';
      ctx.shadowBlur = 14;

      drawRoundedRect(ctx, x + offset, y + offset, size, size, 5);
      ctx.fill();

      // Eyes on the head
      ctx.fillStyle = '#05060a';
      ctx.shadowBlur = 0;
      const eyeSize = 2.5;
      let leftEye = { x: x + 5, y: y + 5 };
      let rightEye = { x: x + 15, y: y + 5 };

      if (direction.x === 1) { // Moving Right
        leftEye = { x: x + 13, y: y + 5 };
        rightEye = { x: x + 13, y: y + 13 };
      } else if (direction.x === -1) { // Moving Left
        leftEye = { x: x + 5, y: y + 5 };
        rightEye = { x: x + 5, y: y + 13 };
      } else if (direction.y === 1) { // Moving Down
        leftEye = { x: x + 5, y: y + 13 };
        rightEye = { x: x + 13, y: y + 13 };
      } else if (direction.y === -1) { // Moving Up
        leftEye = { x: x + 5, y: y + 5 };
        rightEye = { x: x + 13, y: y + 5 };
      }

      ctx.beginPath();
      ctx.arc(leftEye.x, leftEye.y, eyeSize, 0, Math.PI * 2);
      ctx.arc(rightEye.x, rightEye.y, eyeSize, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Body gradient from cyan to neon purple
      const progress = index / snake.length;
      ctx.fillStyle = index % 2 === 0 ? '#00e1ff' : '#39ff88';
      ctx.shadowColor = '#00f6ff';
      ctx.shadowBlur = Math.max(0, 8 * (1 - progress));

      drawRoundedRect(ctx, x + offset, y + offset, size, size, 4);
      ctx.fill();
    }
    ctx.restore();
  });
}

/**
 * Utility to draw rounded rectangles
 */
function drawRoundedRect(ctx, x, y, width, height, radius) {
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

/**
 * Main game loop using requestAnimationFrame
 */
function gameLoop(timestamp) {
  if (isGameOver) return;

  const elapsed = timestamp - lastTickTime;

  if (elapsed >= currentSpeed) {
    lastTickTime = timestamp - (elapsed % currentSpeed);
    update();
  }

  draw();

  if (!isGameOver) {
    animationFrameId = requestAnimationFrame(gameLoop);
  }
}

/**
 * Handle game over state
 */
function triggerGameOver(hasWon = false) {
  isGameOver = true;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (finalScoreElement) {
    finalScoreElement.textContent = score;
  }

  const titleElem = gameOverOverlay.querySelector('h2');
  if (titleElem) {
    titleElem.textContent = hasWon ? 'You Win!' : 'Game Over';
  }

  showGameOver();
}

function showGameOver() {
  gameOverOverlay.classList.add('visible');
}

function hideGameOver() {
  gameOverOverlay.classList.remove('visible', 'show');
}

function updateScoreDisplay() {
  if (scoreElement) {
    scoreElement.textContent = `Score: ${score}`;
  }
}

/**
 * Input handling for arrow keys & WASD
 */
window.addEventListener('keydown', (e) => {
  const key = e.key;

  // Prevent default scroll behavior for arrow keys and space
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(key)) {
    e.preventDefault();
  }

  if (isGameOver) {
    if (key === ' ' || key === 'Enter') {
      initGame();
    }
    return;
  }

  switch (key) {
    case 'ArrowUp':
    case 'w':
    case 'W':
      // Disallow moving opposite to current direction
      if (direction.y === 0) {
        nextDirection = { x: 0, y: -1 };
      }
      break;

    case 'ArrowDown':
    case 's':
    case 'S':
      if (direction.y === 0) {
        nextDirection = { x: 0, y: 1 };
      }
      break;

    case 'ArrowLeft':
    case 'a':
    case 'A':
      if (direction.x === 0) {
        nextDirection = { x: -1, y: 0 };
      }
      break;

    case 'ArrowRight':
    case 'd':
    case 'D':
      if (direction.x === 0) {
        nextDirection = { x: 1, y: 0 };
      }
      break;
  }
});

// Restart button listener
if (restartBtn) {
  restartBtn.addEventListener('click', () => {
    initGame();
  });
}

// Start game automatically on load
window.addEventListener('DOMContentLoaded', () => {
  initGame();
});

// If script loaded after DOMContentLoaded
if (document.readyState === 'complete' || document.readyState === 'interactive') {
  initGame();
}
