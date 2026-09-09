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

  const MODES = {
    CLASSIC: 'classic',
    PORTAL: 'portal',
    LABYRINTH: 'labyrinth',
    HYPER: 'hyper'
  };

  const MODE_CONFIGS = {
    classic: {
      id: 'classic',
      name: 'Classic Matrix',
      wrapAround: false,
      hasObstacles: false,
      speedRamp: 0,
      scoreMultiplier: 1.0,
      description: 'Solid perimeter wall with retro cyberpunk rules.'
    },
    portal: {
      id: 'portal',
      name: 'Cosmic Portal Warp',
      wrapAround: true,
      hasObstacles: false,
      speedRamp: 0,
      scoreMultiplier: 1.0,
      description: 'Wrap-around edges teleport the snake across opposing borders.'
    },
    labyrinth: {
      id: 'labyrinth',
      name: 'Labyrinth Monoliths',
      wrapAround: false,
      hasObstacles: true,
      speedRamp: 0,
      scoreMultiplier: 1.5,
      description: 'Hazard pillars scattered in the arena. Avoid monolith collisions.'
    },
    hyper: {
      id: 'hyper',
      name: 'Hyper Speed Demon',
      wrapAround: false,
      hasObstacles: false,
      speedRamp: 3,
      minSpeed: 45,
      scoreMultiplier: 2.0,
      description: 'Dynamic acceleration on every bite with 2x score multiplier.'
    }
  };

  function getObstacles(mode, width = 20, height = 20) {
    if (mode !== MODES.LABYRINTH) return [];
    const obstacles = [];
    const addBlock = (x, y) => {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        obstacles.push({ x, y });
      }
    };
    // 4 Corner 2x2 Monoliths (safe from center spawn x:10, y:10)
    const corners = [
      { x: 4, y: 4 },
      { x: width - 6, y: 4 },
      { x: 4, y: height - 6 },
      { x: width - 6, y: height - 6 }
    ];
    for (const c of corners) {
      addBlock(c.x, c.y);
      addBlock(c.x + 1, c.y);
      addBlock(c.x, c.y + 1);
      addBlock(c.x + 1, c.y + 1);
    }
    return obstacles;
  }

  function createGameState(options = {}) {
    const width = options.width || 20;
    const height = options.height || 20;
    const startX = Math.floor(width / 2);
    const startY = Math.floor(height / 2);
    const mode = options.mode || MODES.CLASSIC;
    const modeConfig = MODE_CONFIGS[mode] || MODE_CONFIGS.classic;
    const obstacles = getObstacles(mode, width, height);

    const state = {
      gridWidth: width,
      gridHeight: height,
      mode,
      modeConfig,
      obstacles,
      obstacleSet: new Set(obstacles.map(o => `${o.x},${o.y}`)),
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
    if (state.obstacleSet) {
      for (const obs of state.obstacleSet) {
        occupied.add(obs);
      }
    }
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

    let didWarp = false;
    if (state.modeConfig && state.modeConfig.wrapAround) {
      if (newHead.x < 0) {
        newHead.x = state.gridWidth - 1;
        didWarp = true;
      } else if (newHead.x >= state.gridWidth) {
        newHead.x = 0;
        didWarp = true;
      }
      if (newHead.y < 0) {
        newHead.y = state.gridHeight - 1;
        didWarp = true;
      } else if (newHead.y >= state.gridHeight) {
        newHead.y = 0;
        didWarp = true;
      }
    } else {
      if (
        newHead.x < 0 ||
        newHead.x >= state.gridWidth ||
        newHead.y < 0 ||
        newHead.y >= state.gridHeight
      ) {
        state.isGameOver = true;
        return { moved: false, gameOver: true, reason: 'wall_collision' };
      }
    }

    if (state.obstacleSet && state.obstacleSet.has(`${newHead.x},${newHead.y}`)) {
      state.isGameOver = true;
      return { moved: false, gameOver: true, reason: 'obstacle_collision' };
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
      const multiplier = (state.modeConfig && state.modeConfig.scoreMultiplier) || 1.0;
      state.score += Math.round(foodEaten.points * multiplier);
      if (state.score > state.highScore) {
        state.highScore = state.score;
      }
      state.growRemaining += (foodEaten.grow - 1);

      if (state.modeConfig && state.modeConfig.speedRamp > 0) {
        const minSpeed = state.modeConfig.minSpeed || 45;
        state.baseSpeed = Math.max(minSpeed, state.baseSpeed - state.modeConfig.speedRamp);
      }

      if (foodEaten.type === 'freeze') {
        state.activeEffect = {
          type: 'freeze',
          expiresAt: now + (foodEaten.effectDuration || 5000)
        };
        state.currentSpeed = Math.floor(state.baseSpeed * 1.6);
      } else if (!state.activeEffect) {
        state.currentSpeed = state.baseSpeed;
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
      head: newHead,
      didWarp
    };
  }

  function resetGame(state, options = {}) {
    const fresh = createGameState({
      width: state.gridWidth,
      height: state.gridHeight,
      highScore: Math.max(state.score, state.highScore),
      difficulty: options.difficulty || state.difficulty,
      mode: options.mode || state.mode,
      baseSpeed: options.baseSpeed || state.baseSpeed
    });
    Object.assign(state, fresh);
    return state;
  }

  return {
    MODES,
    MODE_CONFIGS,
    getObstacles,
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
