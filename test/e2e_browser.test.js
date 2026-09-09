const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, data }));
    }).on('error', reject);
  });
}

function runCommand(bin, args) {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { timeout: 15000 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ error, stdout, stderr, code: error.code });
      } else {
        resolve({ error: null, stdout, stderr, code: 0 });
      }
    });
  });
}

test('E2E HTTP Server: all game assets are served with HTTP 200 OK', async () => {
  const assets = ['/', '/style.css', '/engine.js', '/game.js'];
  for (const asset of assets) {
    const res = await fetchUrl(`http://localhost:8000${asset}`);
    assert.strictEqual(res.statusCode, 200, `Asset ${asset} should return HTTP 200`);
    assert.ok(res.data.length > 0, `Asset ${asset} should not be empty`);
  }
});

test('E2E Headless Chrome DOM: WebGL canvas and UI controls are properly mounted', async () => {
  const res = await runCommand('google-chrome', [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--dump-dom',
    'http://localhost:8000'
  ]);

  assert.strictEqual(res.code, 0, 'Headless Chrome should exit cleanly');
  const dom = res.stdout;

  // WebGL Container mounting
  assert.ok(dom.includes('id="webglContainer"'), 'DOM must contain webglContainer');

  // HUD Score and Controls
  assert.ok(dom.includes('id="score"'), 'Score display must be present');
  assert.ok(dom.includes('id="highScore"'), 'High score display must be present');
  assert.ok(dom.includes('id="pauseBtn"'), 'Pause button must be present');
  assert.ok(dom.includes('id="muteBtn"'), 'Mute button must be present');
  assert.ok(dom.includes('id="cameraBtn"'), 'Camera toggle button must be present');

  // Difficulty buttons
  assert.ok(dom.includes('id="diffEasy"'), 'Easy button must be present');
  assert.ok(dom.includes('id="diffNormal"'), 'Normal button must be present');
  assert.ok(dom.includes('id="diffBlitz"'), 'Blitz button must be present');

  // Mobile D-Pad
  assert.ok(dom.includes('id="dpadUp"'), 'D-pad Up button must be present');
  assert.ok(dom.includes('id="dpadDown"'), 'D-pad Down button must be present');
  assert.ok(dom.includes('id="dpadLeft"'), 'D-pad Left button must be present');
  assert.ok(dom.includes('id="dpadRight"'), 'D-pad Right button must be present');

  // Arcade Mode Selector and Modal
  assert.ok(dom.includes('id="modeBtn"'), 'Mode selection button must be present');
  assert.ok(dom.includes('id="modeModal" class="modal-backdrop" hidden'), 'Mode selection modal must be present and hidden initially');
  assert.ok(dom.includes('data-mode="classic"'), 'Classic mode card must be present');
  assert.ok(dom.includes('data-mode="portal"'), 'Portal mode card must be present');
  assert.ok(dom.includes('data-mode="labyrinth"'), 'Labyrinth mode card must be present');
  assert.ok(dom.includes('data-mode="hyper"'), 'Hyper mode card must be present');
});

test('E2E Headless Chrome WebGL: renders hardware accelerated 3D scene without crashing', async () => {
  const screenshotPath = path.join(__dirname, 'e2e_render_test.png');
  const res = await runCommand('google-chrome', [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    `--screenshot=${screenshotPath}`,
    '--window-size=800,800',
    'http://localhost:8000'
  ]);

  assert.strictEqual(res.code, 0, 'Headless Chrome screenshot should complete successfully');
  assert.ok(fs.existsSync(screenshotPath), 'Screenshot image file must be generated');
  const stats = fs.statSync(screenshotPath);
  assert.ok(stats.size > 10000, `Screenshot must be a valid non-empty PNG (size: ${stats.size} bytes)`);

  // Clean up test screenshot
  try { fs.unlinkSync(screenshotPath); } catch (e) {}
});
