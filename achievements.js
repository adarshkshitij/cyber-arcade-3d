// ==========================================================================
// 🏆 Cyber Arcade 3D - Achievement & Trophy Tracker (achievements.js)
// Zero-DOM, deterministic, localStorage-backed. Fully unit-testable: the
// module owns one internal state singleton, resettable via resetAchievements()
// so tests can isolate cleanly between cases.
// ==========================================================================

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Achievements = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const STORAGE_KEY = 'arcade_achievements_v1';
  const ALL_VEHICLES = ['interceptor', 'speeder', 'titan'];
  const META_UNLOCK_THRESHOLD = 5;

  const ACHIEVEMENTS = {
    first_blood: {
      id: 'first_blood',
      name: 'First Blood',
      icon: '🩸',
      description: 'Score your first point in Snake.'
    },
    century_serpent: {
      id: 'century_serpent',
      name: 'Century Serpent',
      icon: '🐍',
      description: 'Reach a score of 100 in Snake.'
    },
    speed_demon: {
      id: 'speed_demon',
      name: 'Speed Demon',
      icon: '🏎️',
      description: 'Hit 250 km/h in the Turbo Racer.'
    },
    nitro_junkie: {
      id: 'nitro_junkie',
      name: 'Nitro Junkie',
      icon: '⚡',
      description: 'Trigger Nitro Boost 5 times in a single race.'
    },
    garage_veteran: {
      id: 'garage_veteran',
      name: 'Garage Veteran',
      icon: '🛠️',
      description: 'Drive all 3 vehicles: Interceptor, Speeder, and Titan.'
    },
    absolute_zero: {
      id: 'absolute_zero',
      name: 'Absolute Zero',
      icon: '❄️',
      description: 'Eat a Freeze power-up in Snake.'
    },
    dimension_hopper: {
      id: 'dimension_hopper',
      name: 'Dimension Hopper',
      icon: '🌀',
      description: 'Cross a Portal-mode wall 10 times.'
    },
    arcade_legend: {
      id: 'arcade_legend',
      name: 'Arcade Legend',
      icon: '🏅',
      description: 'Unlock 5 or more other achievements.'
    }
  };

  const ACHIEVEMENT_ORDER = Object.keys(ACHIEVEMENTS);

  function safeGetStorage() {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (e) {
      return null;
    }
  }

  function createFreshState(saved) {
    const savedProgress = (saved && saved.progress) || {};
    return {
      unlocked: (saved && saved.unlocked && typeof saved.unlocked === 'object') ? { ...saved.unlocked } : {},
      progress: {
        vehiclesDriven: Array.isArray(savedProgress.vehiclesDriven) ? [...savedProgress.vehiclesDriven] : [],
        portalWraps: typeof savedProgress.portalWraps === 'number' ? savedProgress.portalWraps : 0
      },
      // Per-run counters are intentionally not persisted - reset at the start
      // of every race via recordEvent('racer_run_start').
      run: { nitroBoosts: 0 }
    };
  }

  function loadState() {
    const storage = safeGetStorage();
    let saved = null;
    if (storage) {
      try {
        const raw = storage.getItem(STORAGE_KEY);
        if (raw) saved = JSON.parse(raw);
      } catch (e) {
        saved = null;
      }
    }
    return createFreshState(saved);
  }

  let state = loadState();

  function persist() {
    const storage = safeGetStorage();
    if (!storage) return;
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify({
        unlocked: state.unlocked,
        progress: state.progress
      }));
    } catch (e) {
      // Storage unavailable/full/quota-exceeded - achievements still work
      // in-memory for the rest of the session, just won't survive reload.
    }
  }

  function tryUnlock(id, condition, newlyUnlockedList) {
    if (condition && !state.unlocked[id]) {
      state.unlocked[id] = Date.now();
      newlyUnlockedList.push({ ...ACHIEVEMENTS[id] });
    }
  }

  function checkMetaAchievement(newlyUnlockedList) {
    const otherUnlockedCount = Object.keys(state.unlocked).filter((id) => id !== 'arcade_legend').length;
    tryUnlock('arcade_legend', otherUnlockedCount >= META_UNLOCK_THRESHOLD, newlyUnlockedList);
  }

  function recordEvent(type, payload) {
    const data = payload || {};
    const newlyUnlocked = [];
    // Some events (notably racer_speed) are expected to be called on every
    // animation frame. Only persist when something actually changed, so a
    // 60fps stream of "still below threshold" checks doesn't spam
    // localStorage.setItem with no-op writes.
    let progressChanged = false;

    switch (type) {
      case 'snake_score':
        tryUnlock('first_blood', (data.score || 0) >= 1, newlyUnlocked);
        tryUnlock('century_serpent', (data.score || 0) >= 100, newlyUnlocked);
        break;

      case 'snake_freeze':
        tryUnlock('absolute_zero', true, newlyUnlocked);
        break;

      case 'portal_wrap':
        state.progress.portalWraps += 1;
        progressChanged = true;
        tryUnlock('dimension_hopper', state.progress.portalWraps >= 10, newlyUnlocked);
        break;

      case 'racer_run_start':
        state.run.nitroBoosts = 0;
        break;

      case 'racer_nitro':
        state.run.nitroBoosts += 1;
        tryUnlock('nitro_junkie', state.run.nitroBoosts >= 5, newlyUnlocked);
        break;

      case 'racer_speed':
        tryUnlock('speed_demon', (data.speed || 0) >= 250, newlyUnlocked);
        break;

      case 'vehicle_driven':
        if (data.vehicle && ALL_VEHICLES.includes(data.vehicle) && !state.progress.vehiclesDriven.includes(data.vehicle)) {
          state.progress.vehiclesDriven.push(data.vehicle);
          progressChanged = true;
        }
        tryUnlock(
          'garage_veteran',
          ALL_VEHICLES.every((v) => state.progress.vehiclesDriven.includes(v)),
          newlyUnlocked
        );
        break;

      default:
        break;
    }

    checkMetaAchievement(newlyUnlocked);

    if (progressChanged || newlyUnlocked.length > 0) {
      persist();
    }

    return newlyUnlocked;
  }

  function getAchievements() {
    return ACHIEVEMENT_ORDER.map((id) => ({
      ...ACHIEVEMENTS[id],
      unlocked: Boolean(state.unlocked[id]),
      unlockedAt: state.unlocked[id] || null
    }));
  }

  function getUnlockedCount() {
    return Object.keys(state.unlocked).length;
  }

  function resetAchievements() {
    state = createFreshState(null);
    persist();
  }

  return {
    ACHIEVEMENTS,
    ACHIEVEMENT_ORDER,
    recordEvent,
    getAchievements,
    getUnlockedCount,
    resetAchievements
  };
}));
