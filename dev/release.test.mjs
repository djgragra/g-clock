import test from 'node:test';
import assert from 'node:assert/strict';
import { isNewer, pickInstaller } from '../src/release.js';

test('version comparison (yy.m.n)', () => {
  assert.ok(isNewer('26.10.2', '26.10.1'));
  assert.ok(isNewer('26.11.1', '26.10.9'));
  assert.ok(isNewer('27.1.1', '26.12.30'));
  assert.ok(isNewer('v26.10.1', '26.9.15'));
  assert.ok(!isNewer('26.10.1', '26.10.1'));
  assert.ok(!isNewer('26.9.15', '26.10.1'));
  assert.ok(isNewer('26.10.1.1', '26.10.1'));
});

const assets = ['G-Clock-Setup-26.10.1.exe', 'G-Clock-26.10.1.dmg', 'G-Clock-26.10.1-arm64.dmg', 'G-Clock-26.10.1.AppImage', 'SHA256SUMS.txt'].map((name) => ({ name }));

test('installer choice per system', () => {
  assert.equal(pickInstaller(assets, 'win32', 'x64').name, 'G-Clock-Setup-26.10.1.exe');
  assert.equal(pickInstaller(assets, 'darwin', 'arm64').name, 'G-Clock-26.10.1-arm64.dmg');
  assert.equal(pickInstaller(assets, 'darwin', 'x64').name, 'G-Clock-26.10.1.dmg');
  assert.equal(pickInstaller(assets, 'linux', 'x64').name, 'G-Clock-26.10.1.AppImage');
  assert.equal(pickInstaller(assets, 'linux', 'arm64'), null);
  assert.equal(pickInstaller([{ name: 'evil.exe' }], 'win32', 'x64'), null);
});
