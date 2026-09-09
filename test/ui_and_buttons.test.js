const test = require('node:test');
const assert = require('node:assert');
const Engine = require('../engine.js');

test('Buttons & Controls: Difficulty selection updates base and current speeds', () => {
  const SPEEDS = { easy: 150, normal: 105, blitz: 70 };
  const state = Engine.createGameState({ difficulty: 'normal', baseSpeed: SPEEDS.normal });

  assert.strictEqual(state.difficulty, 'normal');
  assert.strictEqual(state.baseSpeed, 105);
  assert.strictEqual(state.currentSpeed, 105);

  // Switch to Blitz
  state.difficulty = 'blitz';
  state.baseSpeed = SPEEDS.blitz;
  state.currentSpeed = SPEEDS.blitz;
  assert.strictEqual(state.difficulty, 'blitz');
  assert.strictEqual(state.currentSpeed, 70);

  // Switch to Easy
  state.difficulty = 'easy';
  state.baseSpeed = SPEEDS.easy;
  state.currentSpeed = SPEEDS.easy;
  assert.strictEqual(state.difficulty, 'easy');
  assert.strictEqual(state.currentSpeed, 150);
});

test('Buttons & Controls: Pause toggle prevents engine ticks from moving the snake', () => {
  const state = Engine.createGameState({ width: 20, height: 20 });
  const initialHead = { ...state.snake[0] };

  // Trigger Pause button
  state.isPaused = true;
  const resPaused = Engine.tick(state);
  assert.strictEqual(resPaused.moved, false);
  assert.strictEqual(state.snake[0].x, initialHead.x);
  assert.strictEqual(state.snake[0].y, initialHead.y);

  // Trigger Resume button
  state.isPaused = false;
  const resResumed = Engine.tick(state);
  assert.strictEqual(resResumed.moved, true);
  assert.strictEqual(state.snake[0].x, initialHead.x + 1);
});

test('Buttons & Controls: D-Pad inputs map accurately to 4 directional vectors', () => {
  const state = Engine.createGameState({ width: 20, height: 20 });
  state.direction = { x: 1, y: 0 }; // Moving right

  // Press D-Pad Up
  const changedUp = Engine.changeDirection(state, Engine.DIRECTIONS.UP);
  assert.strictEqual(changedUp, true);
  assert.deepStrictEqual(state.nextDirection, { x: 0, y: -1 });

  // Move 1 tick up
  Engine.tick(state);
  assert.deepStrictEqual(state.direction, { x: 0, y: -1 });

  // Press D-Pad Left
  const changedLeft = Engine.changeDirection(state, Engine.DIRECTIONS.LEFT);
  assert.strictEqual(changedLeft, true);
  assert.deepStrictEqual(state.nextDirection, { x: -1, y: 0 });

  // Press D-Pad Down while moving left
  Engine.tick(state);
  const changedDown = Engine.changeDirection(state, Engine.DIRECTIONS.DOWN);
  assert.strictEqual(changedDown, true);
  assert.deepStrictEqual(state.nextDirection, { x: 0, y: 1 });

  // Press D-Pad Right
  Engine.tick(state);
  const changedRight = Engine.changeDirection(state, Engine.DIRECTIONS.RIGHT);
  assert.strictEqual(changedRight, true);
  assert.deepStrictEqual(state.nextDirection, { x: 1, y: 0 });
});

test('Buttons & Controls: Illegal 180 reversal attempts from D-pad/keyboard are rejected', () => {
  const state = Engine.createGameState({ width: 20, height: 20 });
  state.direction = { x: 1, y: 0 }; // Moving right

  // Attempt to press Left directly
  const illegalLeft = Engine.changeDirection(state, Engine.DIRECTIONS.LEFT);
  assert.strictEqual(illegalLeft, false);
  // Direction remains unchanged
  assert.deepStrictEqual(state.nextDirection, { x: 1, y: 0 });
});

test('Buttons & Controls: Restart action resets score, snake length, and game over state', () => {
  const state = Engine.createGameState({ width: 20, height: 20 });
  state.score = 150;
  state.isGameOver = true;
  state.snake.push({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 }); // Length 6

  // Trigger Restart Button
  Engine.resetGame(state);
  assert.strictEqual(state.score, 0);
  assert.strictEqual(state.isGameOver, false);
  assert.strictEqual(state.snake.length, 3);
  assert.strictEqual(state.highScore, 150); // Preserves high score
});
