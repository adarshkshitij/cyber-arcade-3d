const test = require('node:test');
const assert = require('node:assert');
const Engine = require('../engine.js');

test('Engine: createGameState initializes snake with 3 segments and default bounds', () => {
  const state = Engine.createGameState({ width: 20, height: 20 });
  assert.strictEqual(state.gridWidth, 20);
  assert.strictEqual(state.gridHeight, 20);
  assert.strictEqual(state.snake.length, 3);
  assert.strictEqual(state.score, 0);
  assert.strictEqual(state.isGameOver, false);
  assert.deepStrictEqual(state.direction, { x: 1, y: 0 });
});

test('Engine: movement advances the snake in the current direction', () => {
  const state = Engine.createGameState({ width: 20, height: 20 });
  // Move right
  const prevHead = { ...state.snake[0] };
  const res = Engine.tick(state);
  assert.strictEqual(res.moved, true);
  assert.strictEqual(res.gameOver, false);
  assert.strictEqual(state.snake[0].x, prevHead.x + 1);
  assert.strictEqual(state.snake[0].y, prevHead.y);
  assert.strictEqual(state.snake.length, 3);
});

test('Engine: isValidDirectionChange rejects direct 180 degree reversal', () => {
  const movingRight = { x: 1, y: 0 };
  const movingLeft = { x: -1, y: 0 };
  const movingUp = { x: 0, y: -1 };
  const movingDown = { x: 0, y: 1 };

  assert.strictEqual(Engine.isValidDirectionChange(movingRight, movingLeft), false);
  assert.strictEqual(Engine.isValidDirectionChange(movingRight, movingUp), true);
  assert.strictEqual(Engine.isValidDirectionChange(movingRight, movingDown), true);
  assert.strictEqual(Engine.isValidDirectionChange(movingUp, movingDown), false);
});

test('Engine: wall collision triggers game over when crossing grid boundary', () => {
  const state = Engine.createGameState({ width: 6, height: 6 });
  state.snake = [
    { x: 5, y: 2 },
    { x: 4, y: 2 },
    { x: 3, y: 2 }
  ];
  state.direction = { x: 1, y: 0 };
  state.nextDirection = { x: 1, y: 0 };
  // Place food far away so it doesn't interfere
  state.food = { x: 0, y: 0, type: 'normal', points: 10, grow: 1 };

  const res = Engine.tick(state);
  assert.strictEqual(res.gameOver, true);
  assert.strictEqual(state.isGameOver, true);
  assert.strictEqual(res.reason, 'wall_collision');
});

test('Engine: self collision triggers game over when head hits body', () => {
  const state = Engine.createGameState({ width: 10, height: 10 });
  // Form a loop: head at (3,2), body wrapping around
  state.snake = [
    { x: 3, y: 2 },
    { x: 4, y: 2 },
    { x: 4, y: 3 },
    { x: 3, y: 3 },
    { x: 2, y: 3 }
  ];
  // Next direction is down -> (3,3), which intersects segment #3
  state.direction = { x: 0, y: 1 };
  state.nextDirection = { x: 0, y: 1 };
  state.food = { x: 0, y: 0, type: 'normal', points: 10, grow: 1 };

  const res = Engine.tick(state);
  assert.strictEqual(res.gameOver, true);
  assert.strictEqual(state.isGameOver, true);
  assert.strictEqual(res.reason, 'self_collision');
});

test('Engine: eating food increments score and grows the snake', () => {
  const state = Engine.createGameState({ width: 10, height: 10 });
  state.snake = [
    { x: 3, y: 2 },
    { x: 2, y: 2 },
    { x: 1, y: 2 }
  ];
  state.direction = { x: 1, y: 0 };
  state.nextDirection = { x: 1, y: 0 };
  // Put food directly in front of head at (4,2)
  state.food = { x: 4, y: 2, type: 'normal', points: 10, grow: 1 };

  const res = Engine.tick(state);
  assert.strictEqual(res.ateFood, true);
  assert.strictEqual(res.score, 10);
  assert.strictEqual(state.score, 10);
  // Length should now be 4
  assert.strictEqual(state.snake.length, 4);
});

test('Engine: golden food awards 50 points and 2 growth units', () => {
  const state = Engine.createGameState({ width: 10, height: 10 });
  state.snake = [
    { x: 3, y: 2 },
    { x: 2, y: 2 },
    { x: 1, y: 2 }
  ];
  state.direction = { x: 1, y: 0 };
  state.nextDirection = { x: 1, y: 0 };
  state.food = { x: 4, y: 2, type: 'golden', points: 50, grow: 2 };

  const res = Engine.tick(state);
  assert.strictEqual(res.ateFood, true);
  assert.strictEqual(res.score, 50);
  assert.strictEqual(state.growRemaining, 1); // 1 extra growth deferred to next tick
  assert.strictEqual(state.snake.length, 4);

  // Next normal move should also grow
  state.food = { x: 0, y: 0, type: 'normal', points: 10, grow: 1 };
  Engine.tick(state);
  assert.strictEqual(state.snake.length, 5);
  assert.strictEqual(state.growRemaining, 0);
});

test('Engine: freeze food activates freeze effect and modifies current speed', () => {
  const state = Engine.createGameState({ width: 10, height: 10, baseSpeed: 100 });
  state.snake = [
    { x: 3, y: 2 },
    { x: 2, y: 2 },
    { x: 1, y: 2 }
  ];
  state.direction = { x: 1, y: 0 };
  state.nextDirection = { x: 1, y: 0 };
  state.food = { x: 4, y: 2, type: 'freeze', points: 25, grow: 1, effectDuration: 4000 };

  const now = 100000;
  const res = Engine.tick(state, now);
  assert.strictEqual(res.ateFood, true);
  assert.ok(state.activeEffect);
  assert.strictEqual(state.activeEffect.type, 'freeze');
  assert.strictEqual(state.activeEffect.expiresAt, now + 4000);
  assert.strictEqual(state.currentSpeed, 160); // 100 * 1.6
});
