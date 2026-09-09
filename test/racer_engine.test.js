const test = require('node:test');
const assert = require('node:assert');
const RacerEngine = require('../racer-engine.js');

test('Racer Engine: createRacerState initializes player at center lane', () => {
  const state = RacerEngine.createRacerState();
  assert.strictEqual(state.lane, 0);
  assert.strictEqual(state.targetLane, 0);
  assert.strictEqual(state.speed, 120);
  assert.strictEqual(state.distance, 0);
  assert.strictEqual(state.score, 0);
  assert.strictEqual(state.isGameOver, false);
  assert.strictEqual(state.isBoosting, false);
  assert.strictEqual(state.nitro, 50);
});

test('Racer Engine: steer changes targetLane within bounds (-1 to 1)', () => {
  const state = RacerEngine.createRacerState();
  
  // Steer left from center (0 -> -1)
  RacerEngine.steer(state, 'left');
  assert.strictEqual(state.targetLane, -1);

  // Steer left again should clamp at -1
  RacerEngine.steer(state, 'left');
  assert.strictEqual(state.targetLane, -1);

  // Steer right twice (-1 -> 0 -> 1)
  RacerEngine.steer(state, 'right');
  assert.strictEqual(state.targetLane, 0);
  RacerEngine.steer(state, 'right');
  assert.strictEqual(state.targetLane, 1);

  // Steer right again should clamp at 1
  RacerEngine.steer(state, 'right');
  assert.strictEqual(state.targetLane, 1);
});

test('Racer Engine: activateBoost consumes nitro and sets boost timer', () => {
  const state = RacerEngine.createRacerState();
  state.nitro = 50;

  const activated = RacerEngine.activateBoost(state);
  assert.strictEqual(activated, true);
  assert.strictEqual(state.isBoosting, true);
  assert.strictEqual(state.nitro, 25);
  assert.strictEqual(state.boostTimeRemaining, 3500);

  // Cannot activate while already boosting
  const reActivated = RacerEngine.activateBoost(state);
  assert.strictEqual(reActivated, false);
});

test('Racer Engine: tick advances distance, score, and smoothly interpolates lane', () => {
  const state = RacerEngine.createRacerState();
  RacerEngine.steer(state, 'left'); // targetLane = -1

  const initialDist = state.distance;
  RacerEngine.tick(state, 100); // 100ms tick

  assert.ok(state.distance > initialDist, 'Distance should increase over time');
  assert.ok(state.score > 0, 'Score should increase with distance traveled');
  assert.ok(state.laneOffset < 0, 'laneOffset should interpolate towards targetLane -1');
});

test('Racer Engine: collision with traffic triggers game over and crash event', () => {
  const state = RacerEngine.createRacerState();
  state.laneOffset = 0;
  state.targetLane = 0;

  // Place a traffic car directly in the player path at z = 1.0
  state.traffic = [{
    id: 99,
    lane: 0,
    z: 1.0,
    speed: 50,
    color: 0xff0055
  }];

  const result = RacerEngine.tick(state, 16.67);
  assert.strictEqual(state.isGameOver, true, 'Player should crash into oncoming car');
  const crashEvent = result.events.find(e => e.type === 'crash');
  assert.ok(crashEvent, 'Should dispatch crash event');
  assert.strictEqual(crashEvent.carId, 99);
});

test('Racer Engine: collecting nitro pickup replenishes nitro meter and awards bonus points', () => {
  const state = RacerEngine.createRacerState();
  state.laneOffset = 0;
  state.nitro = 20;

  // Place a nitro cell in player path at z = 0.5
  state.nitroPickups = [{
    id: 101,
    lane: 0,
    z: 0.5
  }];

  const result = RacerEngine.tick(state, 16.67);
  assert.ok(state.nitro >= 55, 'Nitro should replenish by at least +35');
  const pickupEvent = result.events.find(e => e.type === 'nitroPickup');
  assert.ok(pickupEvent, 'Should dispatch nitroPickup event');
  assert.strictEqual(state.nitroPickups.length, 0, 'Pickup should be consumed and removed');
});

test('Racer Engine: resetRacer retains highScore and resets gameplay metrics', () => {
  const state = RacerEngine.createRacerState();
  state.score = 850;
  state.highScore = 850;
  state.distance = 1200;
  state.isGameOver = true;

  const newState = RacerEngine.resetRacer(state);
  assert.strictEqual(newState.score, 0);
  assert.strictEqual(newState.distance, 0);
  assert.strictEqual(newState.highScore, 850, 'High score must be retained');
  assert.strictEqual(newState.isGameOver, false);
});
