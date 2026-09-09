const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

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
