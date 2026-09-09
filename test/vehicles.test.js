const test = require('node:test');
const assert = require('node:assert');
const RacerEngine = require('../racer-engine.js');

test('Vehicles: getVehicles() exposes interceptor, speeder, and titan with expected traits', () => {
  const vehicles = RacerEngine.getVehicles();

  assert.ok(vehicles.interceptor, 'interceptor must exist');
  assert.strictEqual(vehicles.interceptor.icon, '🏎️');
  assert.strictEqual(vehicles.interceptor.speedBonus, 0);
  assert.strictEqual(vehicles.interceptor.nitroRate, 1.0);

  assert.ok(vehicles.speeder, 'speeder must exist');
  assert.strictEqual(vehicles.speeder.icon, '⚡');
  assert.strictEqual(vehicles.speeder.speedBonus, 20);
  assert.ok(vehicles.speeder.handling > vehicles.interceptor.handling, 'speeder must have higher handling than interceptor');

  assert.ok(vehicles.titan, 'titan must exist');
  assert.strictEqual(vehicles.titan.icon, '🛡️');
  assert.strictEqual(vehicles.titan.speedBonus, -10);
  assert.strictEqual(vehicles.titan.nitroRate, 1.4);
});

test('Vehicles: createRacerState defaults to the interceptor when no vehicle is specified', () => {
  const state = RacerEngine.createRacerState({ difficulty: 'normal' });
  assert.strictEqual(state.vehicle, 'interceptor');
  assert.strictEqual(state.vehicleConfig.id, 'interceptor');
  assert.strictEqual(state.baseSpeed, 120, 'interceptor has no speed bonus, so baseSpeed matches the difficulty preset');
  assert.strictEqual(state.maxSpeed, 230);
  assert.strictEqual(state.speed, state.baseSpeed);
});

test('Vehicles: createRacerState falls back to interceptor for an unknown/invalid vehicle id', () => {
  const state = RacerEngine.createRacerState({ difficulty: 'normal', vehicle: 'not-a-real-vehicle' });
  assert.strictEqual(state.vehicle, 'interceptor');
  assert.strictEqual(state.vehicleConfig.id, 'interceptor');
  assert.strictEqual(state.baseSpeed, 120);
});

test('Vehicles: speeder applies a +20 km/h bonus to both baseSpeed and maxSpeed', () => {
  const state = RacerEngine.createRacerState({ difficulty: 'normal', vehicle: 'speeder' });
  assert.strictEqual(state.vehicle, 'speeder');
  assert.strictEqual(state.baseSpeed, 140, '120 (normal baseSpeed) + 20 speedBonus');
  assert.strictEqual(state.maxSpeed, 250, '230 (normal maxSpeed) + 20 speedBonus');
  assert.strictEqual(state.speed, state.baseSpeed, 'starting speed must equal the vehicle-adjusted baseSpeed');
});

test('Vehicles: titan applies a -10 km/h penalty to both baseSpeed and maxSpeed', () => {
  const state = RacerEngine.createRacerState({ difficulty: 'normal', vehicle: 'titan' });
  assert.strictEqual(state.vehicle, 'titan');
  assert.strictEqual(state.baseSpeed, 110, '120 (normal baseSpeed) - 10 speedBonus');
  assert.strictEqual(state.maxSpeed, 220, '230 (normal maxSpeed) - 10 speedBonus');
});

test('Vehicles: speed bonus is applied on top of every difficulty preset, not just normal', () => {
  const easySpeeder = RacerEngine.createRacerState({ difficulty: 'easy', vehicle: 'speeder' });
  assert.strictEqual(easySpeeder.baseSpeed, 110, '90 (easy baseSpeed) + 20 speedBonus');

  const blitzTitan = RacerEngine.createRacerState({ difficulty: 'blitz', vehicle: 'titan' });
  assert.strictEqual(blitzTitan.baseSpeed, 150, '160 (blitz baseSpeed) - 10 speedBonus');
});

test('Vehicles: activateBoost scales boost duration by vehicleConfig.nitroRate', () => {
  const interceptor = RacerEngine.createRacerState({ vehicle: 'interceptor' });
  interceptor.nitro = 50;
  RacerEngine.activateBoost(interceptor);
  assert.strictEqual(interceptor.boostTimeRemaining, 3500, 'interceptor nitroRate is 1.0 -> base 3.5s duration');

  const titan = RacerEngine.createRacerState({ vehicle: 'titan' });
  titan.nitro = 50;
  RacerEngine.activateBoost(titan);
  assert.strictEqual(titan.boostTimeRemaining, 4900, 'titan nitroRate is 1.4 -> 3500 * 1.4 = 4900ms');

  const speeder = RacerEngine.createRacerState({ vehicle: 'speeder' });
  speeder.nitro = 50;
  RacerEngine.activateBoost(speeder);
  assert.strictEqual(speeder.boostTimeRemaining, 3500, 'speeder nitroRate is 1.0 -> base 3.5s duration');
});

test('Vehicles: activateBoost still refuses to activate below the nitro threshold regardless of vehicle', () => {
  const titan = RacerEngine.createRacerState({ vehicle: 'titan' });
  titan.nitro = 10;
  const activated = RacerEngine.activateBoost(titan);
  assert.strictEqual(activated, false);
  assert.strictEqual(titan.isBoosting, false);
});

test('Vehicles: resetRacer preserves the previously selected vehicle', () => {
  const state = RacerEngine.createRacerState({ difficulty: 'normal', vehicle: 'titan' });
  state.score = 500;
  state.highScore = 500;
  state.isGameOver = true;

  const resetState = RacerEngine.resetRacer(state);
  assert.strictEqual(resetState.vehicle, 'titan');
  assert.strictEqual(resetState.baseSpeed, 110);
  assert.strictEqual(resetState.highScore, 500, 'high score must still be retained after a vehicle-aware reset');
});

test('Vehicles: resetRacer defaults to interceptor when called without a prior state', () => {
  const resetState = RacerEngine.resetRacer();
  assert.strictEqual(resetState.vehicle, 'interceptor');
  assert.strictEqual(resetState.highScore, 0);
});
