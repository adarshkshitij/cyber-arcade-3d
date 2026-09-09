// ==========================================================================
// 🏎️ 3D Cyber Highway Racer - Pure Physics & State Engine (racer-engine.js)
// Zero-DOM, Deterministic & Unit-Tested State Machine
// ==========================================================================

(function (root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.RacerEngine = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const LANES = [-1, 0, 1]; // Left, Center, Right
  const LANE_WIDTH = 3.2;   // Distance between lane centers in world units
  const HIGHWAY_LENGTH = 160; // Render/spawn distance along Z-axis

  const DIFFICULTY_SETTINGS = {
    easy: { baseSpeed: 90, maxSpeed: 180, trafficRate: 1400, boostMultiplier: 1.5 },
    normal: { baseSpeed: 120, maxSpeed: 230, trafficRate: 1100, boostMultiplier: 1.6 },
    blitz: { baseSpeed: 160, maxSpeed: 290, trafficRate: 750, boostMultiplier: 1.8 }
  };

  // Cyber Garage - selectable vehicles. speedBonus shifts both baseSpeed and
  // maxSpeed (km/h) up or down from the difficulty preset; nitroRate scales
  // how long a nitro boost lasts in activateBoost().
  const VEHICLES = {
    interceptor: {
      id: 'interceptor',
      name: 'Interceptor',
      icon: '🏎️',
      speedBonus: 0,
      handling: 1.0,
      nitroRate: 1.0,
      description: 'Balanced all-rounder.'
    },
    speeder: {
      id: 'speeder',
      name: 'Speeder',
      icon: '⚡',
      speedBonus: 20,
      handling: 1.3,
      nitroRate: 1.0,
      description: '+20 km/h top speed, high handling.'
    },
    titan: {
      id: 'titan',
      name: 'Titan',
      icon: '🛡️',
      speedBonus: -10,
      handling: 0.85,
      nitroRate: 1.4,
      description: '-10 km/h top speed, 1.4x nitro duration.'
    }
  };

  function getVehicles() {
    return VEHICLES;
  }

  function createRacerState(options = {}) {
    const difficulty = options.difficulty || 'normal';
    const config = DIFFICULTY_SETTINGS[difficulty] || DIFFICULTY_SETTINGS.normal;

    const vehicle = VEHICLES[options.vehicle] ? options.vehicle : 'interceptor';
    const vehicleConfig = VEHICLES[vehicle];
    const baseSpeed = config.baseSpeed + vehicleConfig.speedBonus;
    const maxSpeed = config.maxSpeed + vehicleConfig.speedBonus;

    return {
      lane: 0,              // -1 = Left, 0 = Center, 1 = Right
      targetLane: 0,
      laneOffset: 0,        // -1.0 to 1.0 smooth lateral position
      speed: baseSpeed,      // km/h
      baseSpeed,
      maxSpeed,
      distance: 0,          // Total meters traveled
      score: 0,
      highScore: options.highScore || 0,
      nitro: 50,            // Nitro meter 0 - 100
      isBoosting: false,
      boostTimeRemaining: 0,
      traffic: [],          // Array of oncoming cars: { id, lane, z, speed, color }
      nitroPickups: [],     // Array of pickups: { id, lane, z }
      isGameOver: false,
      isPaused: false,
      lastSpawnTime: 0,
      difficulty,
      vehicle,
      vehicleConfig,
      nextCarId: 1,
      nextPickupId: 1
    };
  }

  function steer(state, direction) {
    if (state.isGameOver || state.isPaused) return state.targetLane;

    if (direction === 'left' && state.targetLane > -1) {
      state.targetLane -= 1;
    } else if (direction === 'right' && state.targetLane < 1) {
      state.targetLane += 1;
    }
    return state.targetLane;
  }

  function steerContinuous(state, direction, dt = 0.016) {
    if (state.isGameOver || state.isPaused) return state.targetLane;

    const lateralRate = 4.0; // lanes per second for smooth analog drift
    if (direction === 'left') {
      state.targetLane = Math.max(-1.15, state.targetLane - lateralRate * dt);
    } else if (direction === 'right') {
      state.targetLane = Math.min(1.15, state.targetLane + lateralRate * dt);
    }
    return state.targetLane;
  }

  function stabilizeSteering(state, dt = 0.016) {
    if (state.isGameOver || state.isPaused) return state.targetLane;
    // When no keys held, gently center towards the nearest discrete lane [-1, 0, 1]
    const targetDiscrete = Math.round(Math.max(-1, Math.min(1, state.targetLane)));
    state.targetLane += (targetDiscrete - state.targetLane) * Math.min(1.0, 6.0 * dt);
    return state.targetLane;
  }


  function activateBoost(state) {
    if (state.isGameOver || state.isPaused || state.nitro < 20 || state.isBoosting) {
      return false;
    }
    const nitroRate = (state.vehicleConfig && state.vehicleConfig.nitroRate) || 1.0;
    state.isBoosting = true;
    state.boostTimeRemaining = 3500 * nitroRate; // 3.5s base, scaled per vehicle
    state.nitro = Math.max(0, state.nitro - 25);
    return true;
  }

  function spawnTraffic(state) {
    const lane = LANES[Math.floor(Math.random() * LANES.length)];
    const tooClose = state.traffic.some(c => c.lane === lane && c.z > HIGHWAY_LENGTH - 30);
    if (tooClose) return;

    const colors = [0xff0055, 0x00e5ff, 0xffcc00, 0xbf55ec];
    const color = colors[Math.floor(Math.random() * colors.length)];
    const trafficSpeed = state.baseSpeed * (0.35 + Math.random() * 0.25);

    state.traffic.push({
      id: state.nextCarId++,
      lane,
      z: HIGHWAY_LENGTH,
      speed: trafficSpeed,
      color
    });

    if (Math.random() < 0.4) {
      const openLanes = LANES.filter(l => l !== lane);
      if (openLanes.length > 0) {
        const pickupLane = openLanes[Math.floor(Math.random() * openLanes.length)];
        state.nitroPickups.push({
          id: state.nextPickupId++,
          lane: pickupLane,
          z: HIGHWAY_LENGTH + 10
        });
      }
    }
  }

  function tick(state, deltaMs = 16.67) {
    if (state.isGameOver || state.isPaused) {
      return { state, events: [] };
    }

    const events = [];
    const dt = deltaMs / 1000;
    const config = DIFFICULTY_SETTINGS[state.difficulty] || DIFFICULTY_SETTINGS.normal;

    if (state.isBoosting) {
      state.boostTimeRemaining -= deltaMs;
      if (state.boostTimeRemaining <= 0) {
        state.isBoosting = false;
        state.boostTimeRemaining = 0;
      }
    }

    const targetSpeed = state.isBoosting ? config.maxSpeed * config.boostMultiplier : config.maxSpeed;
    if (state.speed < targetSpeed) {
      state.speed = Math.min(targetSpeed, state.speed + 45 * dt);
    } else if (state.speed > targetSpeed) {
      state.speed = Math.max(targetSpeed, state.speed - 60 * dt);
    }

    const metersPerSecond = (state.speed * 1000) / 3600;
    const distanceDelta = metersPerSecond * dt;
    state.distance += distanceDelta;
    const scoreMultiplier = state.isBoosting ? 2.5 : 1.0;
    state.score += Math.round(distanceDelta * scoreMultiplier * 0.5);

    if (state.score > state.highScore) {
      state.highScore = state.score;
      events.push({ type: 'newHighScore', score: state.score });
    }

    const steerSpeed = 16.0;
    state.laneOffset += (state.targetLane - state.laneOffset) * Math.min(1.0, steerSpeed * dt);
    state.lane = Math.round(state.laneOffset);

    if (!state.isBoosting && state.nitro < 100) {
      state.nitro = Math.min(100, state.nitro + 2.5 * dt);
    }

    state.lastSpawnTime += deltaMs;
    if (state.lastSpawnTime >= config.trafficRate) {
      state.lastSpawnTime = 0;
      spawnTraffic(state);
    }

    const playerZ = 0;
    const carHitboxDepth = 3.6;

    for (let i = state.traffic.length - 1; i >= 0; i--) {
      const car = state.traffic[i];
      const relSpeedMps = ((state.speed - car.speed) * 1000) / 3600;
      car.z -= relSpeedMps * dt;

      const zOverlap = Math.abs(car.z - playerZ) < (carHitboxDepth / 2);
      const laneOverlap = Math.abs(car.lane - state.laneOffset) < 0.65;

      if (zOverlap && laneOverlap) {
        state.isGameOver = true;
        events.push({ type: 'crash', carId: car.id, distance: Math.round(state.distance) });
        return { state, events };
      }

      if (car.z < -25) {
        state.traffic.splice(i, 1);
        events.push({ type: 'passedCar', carId: car.id });
      }
    }

    for (let i = state.nitroPickups.length - 1; i >= 0; i--) {
      const pickup = state.nitroPickups[i];
      const relSpeedMps = (state.speed * 1000) / 3600;
      pickup.z -= relSpeedMps * dt;

      const zOverlap = Math.abs(pickup.z - playerZ) < 2.0;
      const laneOverlap = Math.abs(pickup.lane - state.laneOffset) < 0.7;

      if (zOverlap && laneOverlap) {
        state.nitro = Math.min(100, state.nitro + 35);
        state.score += 75;
        events.push({ type: 'nitroPickup', id: pickup.id });
        state.nitroPickups.splice(i, 1);
        continue;
      }

      if (pickup.z < -15) {
        state.nitroPickups.splice(i, 1);
      }
    }

    return { state, events };
  }

  function resetRacer(state) {
    const highScore = state ? state.highScore : 0;
    const difficulty = state ? state.difficulty : 'normal';
    const vehicle = state ? state.vehicle : 'interceptor';
    return createRacerState({ highScore, difficulty, vehicle });
  }

  return {
    LANES,
    LANE_WIDTH,
    HIGHWAY_LENGTH,
    DIFFICULTY_SETTINGS,
    VEHICLES,
    getVehicles,
    createRacerState,
    steer,
    steerContinuous,
    stabilizeSteering,
    activateBoost,
    tick,
    resetRacer
  };
}));
