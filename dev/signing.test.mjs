// macOS: the ad-hoc signature (an Apple Silicon Mac refuses an app whose signature is broken: "damaged").
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('macOS: the ad-hoc signature hook is wired into the build and only acts on a Mac app', async () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.build.afterPack, 'dev/sign-adhoc.cjs');
  assert.ok(fs.existsSync(path.join(root, pkg.build.afterPack)));
  const hook = createRequire(import.meta.url)('./sign-adhoc.cjs').default;
  assert.equal(await hook({ electronPlatformName: 'win32' }), undefined); // nothing on Windows
  assert.equal(await hook({ electronPlatformName: 'linux' }), undefined);
  const wf = fs.readFileSync(path.join(root, '.github/workflows/build-installers.yml'), 'utf8');
  assert.match(wf, /CSC_IDENTITY_AUTO_DISCOVERY: "false"/);
  assert.match(wf, /codesign --verify --deep --strict/, 'the workflow checks the apps inside the disk images');
});
