// Snake Core Engine (Universal Module Definition)
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SnakeEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DIRECTIONS = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 }
  };

  const FOOD_TYPES = {
    NORMAL: { type: 'normal', points: 10, color: '#ff3366', grow: 1 },
    GOLDEN: { type: 'golden', points: 50, color: '#ffcc00', grow: 2 },
    FREEZE: { type: 'freeze', points: 25, color: '#00ccff', grow: 1, effectDuration: 5000 }
  };

  function createGameState(options = {}) {
    const width = options.width || 20;
    const height = options.height || 20;
    const startX = Math.floor(width / 2);
    const startY = Math.floor(height / 2);

    const state = {
      gridWidth: width,
      gridHeight: height,
      snake: [
        { x: startX, y: startY },
        { x: startX - 1, y: startY },
        { x: startX - 2, y: startY }
      ],
      direction: { ...DIRECTIONS.RIGHT },
      nextDirection: { ...DIRECTIONS.RIGHT },
      score: 0,
      highScore: options.highScore || 0,
      isGameOver: false,
      isPaused: false,
      growRemaining: 0,
      food: null,
      activeEffect: null,
      difficulty: options.difficulty || 'normal',
      baseSpeed: options.baseSpeed || 120,
      currentSpeed: options.baseSpeed || 120
    };

    spawnFood(state);
    return state;
  }

  function isValidDirectionChange(currentDir, newDir) {
    if (!newDir) return false;
    const isOpposite = currentDir.x + newDir.x === 0 && currentDir.y + newDir.y === 0;
    return !isOpposite;
  }

  function changeDirection(state, newDir) {
    if (state.isGameOver || state.isPaused) return false;
    if (isValidDirectionChange(state.direction, newDir)) {
      state.nextDirection = { ...newDir };
      return true;
    }
    return false;
  }

  function spawnFood(state, customType = null, randomFn = Math.random) {
    const occupied = new Set(state.snake.map(s => `${s.x},${s.y}`));
    const emptyCells = [];

    for (let x = 0; x < state.gridWidth; x++) {
      for (let y = 0; y < state.gridHeight; y++) {
        if (!occupied.has(`${x},${y}`)) {
          emptyCells.push({ x, y });
        }
      }
    }

    if (emptyCells.length === 0) {
      state.isGameOver = true;
      return null;
    }

    const chosenCell = emptyCells[Math.floor(randomFn() * emptyCells.length)];
    let foodType = FOOD_TYPES.NORMAL;

    if (customType && FOOD_TYPES[customType.toUpperCase()]) {
      foodType = FOOD_TYPES[customType.toUpperCase()];
    } else {
      const roll = randomFn();
      if (roll < 0.15) {
        foodType = FOOD_TYPES.FREEZE;
      } else if (roll < 0.35) {
        foodType = FOOD_TYPES.GOLDEN;
      } else {
        foodType = FOOD_TYPES.NORMAL;
      }
    }

    state.food = {
      x: chosenCell.x,
      y: chosenCell.y,
      ...foodType
    };

    return state.food;
  }

  function tick(state, now = Date.now(), randomFn = Math.random) {
    if (state.isGameOver || state.isPaused) {
      return { moved: false, gameOver: state.isGameOver };
    }

    if (state.activeEffect && now > state.activeEffect.expiresAt) {
      state.activeEffect = null;
      state.currentSpeed = state.baseSpeed;
    }

    state.direction = { ...state.nextDirection };

    const head = state.snake[0];
    const newHead = {
      x: head.x + state.direction.x,
      y: head.y + state.direction.y
    };

    if (
      newHead.x < 0 ||
      newHead.x >= state.gridWidth ||
      newHead.y < 0 ||
      newHead.y >= state.gridHeight
    ) {
      state.isGameOver = true;
      return { moved: false, gameOver: true, reason: 'wall_collision' };
    }

    const willGrow = state.food && newHead.x === state.food.x && newHead.y === state.food.y;
    const bodyToCheck = willGrow || state.growRemaining > 0
      ? state.snake
      : state.snake.slice(0, -1);

    const hitSelf = bodyToCheck.some(seg => seg.x === newHead.x && seg.y === newHead.y);
    if (hitSelf) {
      state.isGameOver = true;
      return { moved: false, gameOver: true, reason: 'self_collision' };
    }

    state.snake.unshift(newHead);

    let ateFood = false;
    let foodEaten = null;

    if (willGrow) {
      ateFood = true;
      foodEaten = { ...state.food };
      state.score += foodEaten.points;
      if (state.score > state.highScore) {
        state.highScore = state.score;
      }
      state.growRemaining += (foodEaten.grow - 1);

      if (foodEaten.type === 'freeze') {
        state.activeEffect = {
          type: 'freeze',
          expiresAt: now + (foodEaten.effectDuration || 5000)
        };
        state.currentSpeed = Math.floor(state.baseSpeed * 1.6);
      }

      spawnFood(state, null, randomFn);
    } else {
      if (state.growRemaining > 0) {
        state.growRemaining--;
      } else {
        state.snake.pop();
      }
    }

    return {
      moved: true,
      gameOver: false,
      ateFood,
      foodEaten,
      score: state.score,
      head: newHead
    };
  }

  function resetGame(state, options = {}) {
    const fresh = createGameState({
      width: state.gridWidth,
      height: state.gridHeight,
      highScore: Math.max(state.score, state.highScore),
      difficulty: options.difficulty || state.difficulty,
      baseSpeed: options.baseSpeed || state.baseSpeed
    });
    Object.assign(state, fresh);
    return state;
  }

  return {
    DIRECTIONS,
    FOOD_TYPES,
    createGameState,
    isValidDirectionChange,
    changeDirection,
    spawnFood,
    tick,
    resetGame
  };
});
