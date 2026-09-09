const test = require('node:test');
const assert = require('node:assert');
const SnakeEngine = require('../engine.js');

test('Modes: engine exports all 4 game modes and configs', () => {
  assert.ok(SnakeEngine.MODES.CLASSIC === 'classic');
  assert.ok(SnakeEngine.MODES.PORTAL === 'portal');
  assert.ok(SnakeEngine.MODES.LABYRINTH === 'labyrinth');
  assert.ok(SnakeEngine.MODES.HYPER === 'hyper');

  assert.ok(SnakeEngine.MODE_CONFIGS.classic.wrapAround === false);
  assert.ok(SnakeEngine.MODE_CONFIGS.portal.wrapAround === true);
  assert.ok(SnakeEngine.MODE_CONFIGS.labyrinth.hasObstacles === true);
  assert.ok(SnakeEngine.MODE_CONFIGS.hyper.speedRamp > 0);
  assert.strictEqual(SnakeEngine.MODE_CONFIGS.hyper.scoreMultiplier, 2.0);
});

test('Modes [Portal]: snake wraps horizontally across boundaries without dying', () => {
  const state = SnakeEngine.createGameState({
    width: 10,
    height: 10,
    mode: 'portal'
  });

  // Position snake right at the right edge moving RIGHT
  state.snake = [{ x: 9, y: 5 }, { x: 8, y: 5 }, { x: 7, y: 5 }];
  state.direction = { x: 1, y: 0 };
  state.nextDirection = { x: 1, y: 0 };

  const res = SnakeEngine.tick(state);
  assert.strictEqual(res.moved, true);
  assert.strictEqual(res.gameOver, false);
  assert.strictEqual(res.didWarp, true);
  assert.strictEqual(state.snake[0].x, 0, 'Head should wrap to x=0');
  assert.strictEqual(state.snake[0].y, 5);
});

test('Modes [Portal]: snake wraps vertically across boundaries without dying', () => {
  const state = SnakeEngine.createGameState({
    width: 10,
    height: 10,
    mode: 'portal'
  });

  // Position snake at top edge moving UP
  state.snake = [{ x: 5, y: 0 }, { x: 5, y: 1 }, { x: 5, y: 2 }];
  state.direction = { x: 0, y: -1 };
  state.nextDirection = { x: 0, y: -1 };

  const res = SnakeEngine.tick(state);
  assert.strictEqual(res.moved, true);
  assert.strictEqual(res.gameOver, false);
  assert.strictEqual(res.didWarp, true);
  assert.strictEqual(state.snake[0].y, 9, 'Head should wrap to y=9 (height-1)');
});

test('Modes [Labyrinth]: generates obstacles and triggers obstacle collision game over', () => {
  const state = SnakeEngine.createGameState({
    width: 20,
    height: 20,
    mode: 'labyrinth'
  });

  assert.ok(state.obstacles.length > 0, 'Labyrinth must contain hazard obstacles');
  assert.ok(state.obstacleSet.size > 0);

  // Take the first obstacle coordinate
  const obs = state.obstacles[0];
  // Place snake adjacent to this obstacle, pointing towards it
  state.snake = [{ x: obs.x - 1, y: obs.y }, { x: obs.x - 2, y: obs.y }, { x: obs.x - 3, y: obs.y }];
  state.direction = { x: 1, y: 0 };
  state.nextDirection = { x: 1, y: 0 };

  const res = SnakeEngine.tick(state);
  assert.strictEqual(res.gameOver, true);
  assert.strictEqual(res.reason, 'obstacle_collision');
});

test('Modes [Labyrinth]: food spawner never spawns food on obstacle tiles', () => {
  const state = SnakeEngine.createGameState({
    width: 20,
    height: 20,
    mode: 'labyrinth'
  });

  for (let i = 0; i < 50; i++) {
    const food = SnakeEngine.spawnFood(state);
    if (food) {
      assert.ok(
        !state.obstacleSet.has(`${food.x},${food.y}`),
        `Food spawned at (${food.x},${food.y}) must not collide with obstacles`
      );
    }
  }
});

test('Modes [Hyper]: eating food ramps speed and doubles score multiplier', () => {
  const state = SnakeEngine.createGameState({
    width: 20,
    height: 20,
    mode: 'hyper',
    baseSpeed: 100
  });

  const initialSpeed = state.baseSpeed;
  // Place food directly in front of snake
  state.food = { x: state.snake[0].x + 1, y: state.snake[0].y, points: 10, grow: 1, type: 'normal' };
  state.direction = { x: 1, y: 0 };
  state.nextDirection = { x: 1, y: 0 };

  const res = SnakeEngine.tick(state);
  assert.strictEqual(res.ateFood, true);
  assert.strictEqual(res.score, 20, 'Hyper mode must award 2x points (10 * 2 = 20)');
  assert.ok(state.baseSpeed < initialSpeed, `Speed should accelerate (new speed: ${state.baseSpeed})`);
});

test('Modes [Portal]: snake wraps left and bottom boundaries', () => {
  const state = SnakeEngine.createGameState({ width: 10, height: 10, mode: 'portal' });
  // Left edge
  state.snake = [{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }];
  state.direction = { x: -1, y: 0 };
  state.nextDirection = { x: -1, y: 0 };
  const resLeft = SnakeEngine.tick(state);
  assert.strictEqual(resLeft.didWarp, true);
  assert.strictEqual(state.snake[0].x, 9);

  // Bottom edge
  state.snake = [{ x: 5, y: 9 }, { x: 5, y: 8 }, { x: 5, y: 7 }];
  state.direction = { x: 0, y: 1 };
  state.nextDirection = { x: 0, y: 1 };
  const resBottom = SnakeEngine.tick(state);
  assert.strictEqual(resBottom.didWarp, true);
  assert.strictEqual(state.snake[0].y, 0);
});

test('Modes [Hyper]: speed ramp does not drop below minSpeed', () => {
  const state = SnakeEngine.createGameState({ width: 20, height: 20, mode: 'hyper', baseSpeed: 50 });
  for (let i = 0; i < 5; i++) {
    state.food = { x: state.snake[0].x + 1, y: state.snake[0].y, points: 10, grow: 1, type: 'normal' };
    state.direction = { x: 1, y: 0 };
    state.nextDirection = { x: 1, y: 0 };
    SnakeEngine.tick(state);
  }
  assert.strictEqual(state.baseSpeed, 45, 'Speed should be clamped at minSpeed (45)');
});

