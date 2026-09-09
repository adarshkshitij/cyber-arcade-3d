const test = require('node:test');
const assert = require('node:assert');

const ACHIEVEMENTS_PATH = require.resolve('../achievements.js');
const Achievements = require(ACHIEVEMENTS_PATH);

// The module keeps one internal state singleton (by design - callers don't
// thread state through every call), so every test resets it first for
// isolation. This doubles as the test coverage for resetAchievements() itself.
test.beforeEach(() => {
  Achievements.resetAchievements();
});

test('Achievements: getAchievements() lists exactly the 8 required trophies, all locked initially', () => {
  const list = Achievements.getAchievements();
  assert.strictEqual(list.length, 8);

  const ids = list.map((a) => a.id);
  assert.deepStrictEqual(ids, [
    'first_blood',
    'century_serpent',
    'speed_demon',
    'nitro_junkie',
    'garage_veteran',
    'absolute_zero',
    'dimension_hopper',
    'arcade_legend'
  ]);

  list.forEach((a) => {
    assert.strictEqual(a.unlocked, false);
    assert.strictEqual(a.unlockedAt, null);
    assert.ok(a.icon && a.name && a.description, `${a.id} must have icon/name/description`);
  });

  assert.strictEqual(Achievements.getUnlockedCount(), 0);
});

test('Achievements: snake_score unlocks first_blood at score 1 but not century_serpent yet', () => {
  const unlocked = Achievements.recordEvent('snake_score', { score: 1 });
  assert.strictEqual(unlocked.length, 1);
  assert.strictEqual(unlocked[0].id, 'first_blood');
  assert.strictEqual(Achievements.getUnlockedCount(), 1);

  const stillLocked = Achievements.getAchievements().find((a) => a.id === 'century_serpent');
  assert.strictEqual(stillLocked.unlocked, false);
});

test('Achievements: snake_score at 100 unlocks both first_blood and century_serpent in one call', () => {
  const unlocked = Achievements.recordEvent('snake_score', { score: 100 });
  const ids = unlocked.map((a) => a.id).sort();
  assert.deepStrictEqual(ids, ['century_serpent', 'first_blood']);
  assert.strictEqual(Achievements.getUnlockedCount(), 2);
});

test('Achievements: unlocking is idempotent - repeat events never re-award the same trophy', () => {
  Achievements.recordEvent('snake_score', { score: 5 });
  const secondCall = Achievements.recordEvent('snake_score', { score: 5 });
  assert.deepStrictEqual(secondCall, []);
  assert.strictEqual(Achievements.getUnlockedCount(), 1);
});

test('Achievements: snake_freeze unlocks absolute_zero exactly once', () => {
  const first = Achievements.recordEvent('snake_freeze', {});
  assert.strictEqual(first.length, 1);
  assert.strictEqual(first[0].id, 'absolute_zero');

  const second = Achievements.recordEvent('snake_freeze', {});
  assert.deepStrictEqual(second, []);
});

test('Achievements: portal_wrap only unlocks dimension_hopper on the 10th cumulative wrap', () => {
  let unlockedOnNinth = null;
  for (let i = 0; i < 9; i++) {
    unlockedOnNinth = Achievements.recordEvent('portal_wrap', {});
  }
  assert.deepStrictEqual(unlockedOnNinth, [], 'must still be locked after 9 wraps');

  const tenth = Achievements.recordEvent('portal_wrap', {});
  assert.strictEqual(tenth.length, 1);
  assert.strictEqual(tenth[0].id, 'dimension_hopper');
});

test('Achievements: racer_speed unlocks speed_demon at 250 km/h but not below', () => {
  const below = Achievements.recordEvent('racer_speed', { speed: 249 });
  assert.deepStrictEqual(below, []);

  const atThreshold = Achievements.recordEvent('racer_speed', { speed: 250 });
  assert.strictEqual(atThreshold.length, 1);
  assert.strictEqual(atThreshold[0].id, 'speed_demon');
});

test('Achievements: nitro_junkie requires 5 nitro triggers within a single race (per-run counter)', () => {
  Achievements.recordEvent('racer_run_start', {});
  let unlocked = [];
  for (let i = 0; i < 4; i++) {
    unlocked = Achievements.recordEvent('racer_nitro', {});
  }
  assert.deepStrictEqual(unlocked, [], 'must still be locked after only 4 boosts');

  const fifth = Achievements.recordEvent('racer_nitro', {});
  assert.strictEqual(fifth.length, 1);
  assert.strictEqual(fifth[0].id, 'nitro_junkie');
});

test('Achievements: racer_run_start resets the per-run nitro counter between races', () => {
  Achievements.recordEvent('racer_run_start', {});
  Achievements.recordEvent('racer_nitro', {});
  Achievements.recordEvent('racer_nitro', {});
  Achievements.recordEvent('racer_nitro', {});
  Achievements.recordEvent('racer_nitro', {});
  // 4 boosts so far this run, not unlocked yet.
  assert.strictEqual(Achievements.getUnlockedCount(), 0);

  // A new race starts - the counter must reset, not carry over.
  Achievements.recordEvent('racer_run_start', {});
  const afterOneMore = Achievements.recordEvent('racer_nitro', {});
  assert.deepStrictEqual(afterOneMore, [], 'a single boost in the new run must not unlock nitro_junkie');
});

test('Achievements: garage_veteran only unlocks once all 3 vehicles have been driven', () => {
  let unlocked = Achievements.recordEvent('vehicle_driven', { vehicle: 'interceptor' });
  assert.deepStrictEqual(unlocked, []);

  unlocked = Achievements.recordEvent('vehicle_driven', { vehicle: 'speeder' });
  assert.deepStrictEqual(unlocked, []);

  // Driving the same vehicle again must not error or double-count.
  unlocked = Achievements.recordEvent('vehicle_driven', { vehicle: 'speeder' });
  assert.deepStrictEqual(unlocked, []);

  unlocked = Achievements.recordEvent('vehicle_driven', { vehicle: 'titan' });
  assert.strictEqual(unlocked.length, 1);
  assert.strictEqual(unlocked[0].id, 'garage_veteran');
});

test('Achievements: an unknown vehicle id in vehicle_driven is ignored, not crashed on', () => {
  assert.doesNotThrow(() => {
    Achievements.recordEvent('vehicle_driven', { vehicle: 'not-a-real-vehicle' });
  });
  assert.strictEqual(Achievements.getUnlockedCount(), 0);
});

test('Achievements: arcade_legend unlocks automatically once 5 other achievements are unlocked', () => {
  Achievements.recordEvent('snake_score', { score: 100 }); // first_blood + century_serpent (2)
  Achievements.recordEvent('snake_freeze', {}); // absolute_zero (3)
  Achievements.recordEvent('racer_speed', { speed: 260 }); // speed_demon (4)

  assert.strictEqual(Achievements.getUnlockedCount(), 4, 'sanity check before the 5th unlock');

  const finalBatch = Achievements.recordEvent('portal_wrap', { }); // won't unlock alone
  assert.deepStrictEqual(finalBatch, []);

  // Drive the 9 remaining wraps to cross the dimension_hopper threshold (5th trophy),
  // which must also cross the arcade_legend meta-threshold in the same call.
  for (let i = 0; i < 8; i++) {
    Achievements.recordEvent('portal_wrap', {});
  }
  const tenthWrap = Achievements.recordEvent('portal_wrap', {});
  const ids = tenthWrap.map((a) => a.id).sort();
  assert.deepStrictEqual(ids, ['arcade_legend', 'dimension_hopper']);
  assert.strictEqual(Achievements.getUnlockedCount(), 6);
});

test('Achievements: a no-op racer_speed check (already unlocked, no progress change) does not touch localStorage', () => {
  function createMockStorage() {
    const store = new Map();
    return {
      setItemCalls: 0,
      getItem(key) { return store.has(key) ? store.get(key) : null; },
      setItem(key, value) { this.setItemCalls += 1; store.set(key, String(value)); },
      removeItem(key) { store.delete(key); }
    };
  }

  const originalLocalStorage = global.localStorage;
  const mockStorage = createMockStorage();
  global.localStorage = mockStorage;

  try {
    delete require.cache[ACHIEVEMENTS_PATH];
    const fresh = require(ACHIEVEMENTS_PATH);
    fresh.resetAchievements();
    const writesAfterReset = mockStorage.setItemCalls;

    // First crossing of the threshold: must unlock and persist.
    fresh.recordEvent('racer_speed', { speed: 260 });
    assert.ok(mockStorage.setItemCalls > writesAfterReset, 'the unlocking call must persist');
    const writesAfterUnlock = mockStorage.setItemCalls;

    // Simulate 60 more per-frame speed checks at an even higher speed: since
    // speed_demon is already unlocked and no progress counter is involved,
    // none of these should write to storage again.
    for (let i = 0; i < 60; i++) {
      fresh.recordEvent('racer_speed', { speed: 300 });
    }
    assert.strictEqual(mockStorage.setItemCalls, writesAfterUnlock, 'no-op frames must not spam localStorage.setItem');
  } finally {
    global.localStorage = originalLocalStorage;
    delete require.cache[ACHIEVEMENTS_PATH];
    require(ACHIEVEMENTS_PATH).resetAchievements();
  }
});

test('Achievements: unknown event types are safely ignored', () => {
  const unlocked = Achievements.recordEvent('totally_made_up_event', { anything: true });
  assert.deepStrictEqual(unlocked, []);
  assert.strictEqual(Achievements.getUnlockedCount(), 0);
});

test('Achievements: recordEvent tolerates a missing payload argument', () => {
  assert.doesNotThrow(() => {
    Achievements.recordEvent('snake_score');
    Achievements.recordEvent('racer_speed');
    Achievements.recordEvent('vehicle_driven');
  });
  assert.strictEqual(Achievements.getUnlockedCount(), 0);
});

test('Achievements: resetAchievements() clears unlocks and cumulative progress back to zero', () => {
  Achievements.recordEvent('snake_score', { score: 100 });
  Achievements.recordEvent('portal_wrap', {});
  assert.ok(Achievements.getUnlockedCount() > 0);

  Achievements.resetAchievements();

  assert.strictEqual(Achievements.getUnlockedCount(), 0);
  Achievements.getAchievements().forEach((a) => assert.strictEqual(a.unlocked, false));

  // Cumulative progress (e.g. portal wraps) must also reset, not just unlocks -
  // otherwise a single post-reset wrap would incorrectly sit at "1 of 10" vs "9 of 10".
  for (let i = 0; i < 9; i++) {
    Achievements.recordEvent('portal_wrap', {});
  }
  assert.strictEqual(Achievements.getUnlockedCount(), 0, 'dimension_hopper must not unlock until a fresh 10 wraps post-reset');
});

// --------------------------------------------------------------------------
// Persistence round-trip: Node has no native `localStorage`, so achievements.js
// guards every storage call behind a `typeof localStorage !== 'undefined'`
// check and works purely in-memory in every test above. To verify the actual
// localStorage.setItem/getItem round-trip, we install a minimal in-memory
// mock as a global, then force a fresh module load (bypassing Node's require
// cache) so the module's `let state = loadState()` top-level read picks it up.
// --------------------------------------------------------------------------
test('Achievements: persists unlocked achievements and progress across a reload via localStorage', () => {
  function createMockStorage() {
    const store = new Map();
    return {
      getItem: (key) => (store.has(key) ? store.get(key) : null),
      setItem: (key, value) => { store.set(key, String(value)); },
      removeItem: (key) => { store.delete(key); }
    };
  }

  const originalLocalStorage = global.localStorage;
  global.localStorage = createMockStorage();

  try {
    delete require.cache[ACHIEVEMENTS_PATH];
    const sessionOne = require(ACHIEVEMENTS_PATH);
    sessionOne.resetAchievements();
    sessionOne.recordEvent('snake_score', { score: 100 });
    sessionOne.recordEvent('portal_wrap', {});
    assert.strictEqual(sessionOne.getUnlockedCount(), 2);

    // Simulate a page reload: drop the cached module and require it again so
    // its top-level `loadState()` re-reads from the (still populated) mock.
    delete require.cache[ACHIEVEMENTS_PATH];
    const sessionTwo = require(ACHIEVEMENTS_PATH);

    assert.strictEqual(sessionTwo.getUnlockedCount(), 2, 'unlocked achievements must survive the reload');
    const restored = sessionTwo.getAchievements();
    assert.ok(restored.find((a) => a.id === 'first_blood').unlocked);
    assert.ok(restored.find((a) => a.id === 'century_serpent').unlocked);

    // Cumulative progress (portalWraps = 1) must also have round-tripped, so
    // 9 more wraps (not 10) should be enough to cross the threshold now.
    for (let i = 0; i < 8; i++) {
      sessionTwo.recordEvent('portal_wrap', {});
    }
    const ninthTotalWrap = sessionTwo.recordEvent('portal_wrap', {});
    assert.strictEqual(ninthTotalWrap.length, 1);
    assert.strictEqual(ninthTotalWrap[0].id, 'dimension_hopper');
  } finally {
    global.localStorage = originalLocalStorage;
    delete require.cache[ACHIEVEMENTS_PATH];
    // Restore the plain in-memory (no-localStorage) module for any test files
    // that run after this one in the same process.
    require(ACHIEVEMENTS_PATH).resetAchievements();
  }
});
