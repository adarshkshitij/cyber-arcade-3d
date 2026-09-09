const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

// --------------------------------------------------------------------------
// sw.js behavioral test harness
//
// Service workers only run in a browser (self/caches/fetch/FetchEvent), so
// to unit test the real fetch-handler logic in Node we load sw.js's source
// into a vm sandbox with minimal mocks for those globals, capture whatever
// handler it registers via self.addEventListener('fetch', ...), and drive it
// with a fake FetchEvent that records what respondWith()/waitUntil() receive.
// --------------------------------------------------------------------------

function fakeResponse(status, tag) {
  return {
    status,
    tag,
    clone() {
      return fakeResponse(status, tag);
    }
  };
}

function loadServiceWorker({ cachedResponse, networkResponse, networkError, onPut } = {}) {
  const swSource = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  const listeners = {};
  const putCalls = [];

  const mockCache = {
    match: async () => cachedResponse,
    put: async (request, response) => {
      putCalls.push({ request, response });
      if (onPut) return onPut(request, response);
    },
    addAll: async () => {}
  };

  const sandbox = {
    self: {
      addEventListener: (type, handler) => { listeners[type] = handler; },
      skipWaiting: () => {},
      clients: { claim: () => {} }
    },
    caches: {
      open: async () => mockCache,
      match: async () => cachedResponse,
      keys: async () => [],
      delete: async () => true
    },
    fetch: async () => {
      if (networkError) throw networkError;
      return networkResponse;
    }
  };

  vm.createContext(sandbox);
  vm.runInContext(swSource, sandbox, { filename: 'sw.js' });

  return { listeners, putCalls };
}

function createFetchEvent(request) {
  let responsePromise = null;
  const waitUntilPromises = [];
  return {
    request,
    respondWith(value) { responsePromise = Promise.resolve(value); },
    waitUntil(value) { waitUntilPromises.push(Promise.resolve(value)); },
    getResponse: () => responsePromise,
    getWaitUntilPromises: () => waitUntilPromises
  };
}

test('PWA: manifest.json is valid and contains standard metadata', () => {
  const manifestPath = path.join(__dirname, '..', 'manifest.json');
  assert.ok(fs.existsSync(manifestPath), 'manifest.json must exist');
  
  const content = fs.readFileSync(manifestPath, 'utf8');
  const manifest = JSON.parse(content);
  
  assert.strictEqual(manifest.name, 'Cyber Arcade 3D');
  assert.strictEqual(manifest.short_name, 'CyberArcade');
  assert.strictEqual(manifest.display, 'standalone');
  assert.strictEqual(manifest.start_url, './');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0, 'Must have at least one icon');
  assert.strictEqual(manifest.icons[0].src, 'icon.svg');
});

test('PWA: icon.svg exists and contains valid scalable vector markup', () => {
  const iconPath = path.join(__dirname, '..', 'icon.svg');
  assert.ok(fs.existsSync(iconPath), 'icon.svg must exist');
  const svg = fs.readFileSync(iconPath, 'utf8');
  assert.ok(svg.includes('<svg'), 'Must contain <svg tag');
  assert.ok(svg.includes('viewBox="0 0 512 512"'), 'Must have 512x512 viewBox');
});

test('PWA: Service Worker sw.js passes JavaScript AST validation', () => {
  const swPath = path.join(__dirname, '..', 'sw.js');
  assert.ok(fs.existsSync(swPath), 'sw.js must exist');
  // Validate syntax via node --check
  assert.doesNotThrow(() => {
    execFileSync('node', ['--check', swPath]);
  }, 'sw.js must be syntactically valid JavaScript');
});

test('PWA sw.js fetch handler: non-GET requests are ignored (never intercepted)', () => {
  const { listeners } = loadServiceWorker({});
  const event = createFetchEvent({ method: 'POST', url: 'https://example.test/score' });

  listeners.fetch(event);

  assert.strictEqual(event.getResponse(), null, 'respondWith must not be called for non-GET requests');
  assert.strictEqual(event.getWaitUntilPromises().length, 0, 'waitUntil must not be called for non-GET requests');
});

test('PWA sw.js fetch handler: serves the cached response immediately on a cache hit (stale-while-revalidate)', async () => {
  const cached = fakeResponse(200, 'cached');
  const fresh = fakeResponse(200, 'fresh');
  const { listeners } = loadServiceWorker({ cachedResponse: cached, networkResponse: fresh });

  const event = createFetchEvent({ method: 'GET', url: 'https://example.test/style.css' });
  listeners.fetch(event);

  const response = await event.getResponse();
  assert.strictEqual(response, cached, 'a cache hit must be served without waiting on the network');
});

test('PWA sw.js fetch handler: falls back to the cached response when the network fetch fails', async () => {
  const cached = fakeResponse(200, 'cached');
  const { listeners } = loadServiceWorker({
    cachedResponse: cached,
    networkError: new TypeError('network down')
  });

  const event = createFetchEvent({ method: 'GET', url: 'https://example.test/game.js' });
  listeners.fetch(event);

  const waitUntilPromises = event.getWaitUntilPromises();
  assert.strictEqual(waitUntilPromises.length, 1, 'the fetch handler must register exactly one waitUntil promise');

  // The revalidation promise passed to waitUntil must resolve (not reject)
  // even when the network fails, falling back to the cached response.
  const revalidationResult = await waitUntilPromises[0];
  assert.strictEqual(revalidationResult, cached);

  const response = await event.getResponse();
  assert.strictEqual(response, cached, 'the page must still receive the cached response on network failure');
});

test('PWA sw.js fetch handler: event.waitUntil() keeps the worker alive until cache.put() actually completes', async () => {
  const cached = fakeResponse(200, 'cached');
  const fresh = fakeResponse(200, 'fresh');

  let resolvePut;
  const putGate = new Promise((resolve) => { resolvePut = resolve; });

  const { listeners, putCalls } = loadServiceWorker({
    cachedResponse: cached,
    networkResponse: fresh,
    onPut: () => putGate
  });

  const event = createFetchEvent({ method: 'GET', url: 'https://example.test/index.html' });
  listeners.fetch(event);

  const waitUntilPromises = event.getWaitUntilPromises();
  assert.strictEqual(waitUntilPromises.length, 1, 'the fetch handler must call event.waitUntil() with the revalidation promise');

  let settled = false;
  waitUntilPromises[0].then(() => { settled = true; });

  // Flush pending microtasks: cache.put() has been invoked but its own
  // promise is still pending (the gate above hasn't been released yet).
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.strictEqual(putCalls.length, 1, 'cache.put() must have been called during revalidation');
  assert.strictEqual(settled, false, 'the waitUntil promise must not resolve before cache.put() completes');

  resolvePut();
  await waitUntilPromises[0];
  assert.strictEqual(settled, true, 'the waitUntil promise must resolve once cache.put() completes');
});
