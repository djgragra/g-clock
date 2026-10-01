// Version comparison and installer choice for the guided update. Pure code, unit tested.

const parts = (v) => String(v || '').replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);

export function isNewer(latest, current) {
  const a = parts(latest);
  const b = parts(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

// Installer for the running system: Windows setup .exe, macOS .dmg matching the processor
// (-arm64 for Apple silicon, no suffix for Intel), Linux .AppImage (x64 only).
export function pickInstaller(assets, platform = process.platform, arch = process.arch) {
  const tests = {
    win32: (n) => /^G-Clock-Setup-[\d.]+\.exe$/i.test(n),
    darwin: (n) => (arch === 'arm64' ? /^G-Clock-[\d.]+-arm64\.dmg$/i.test(n) : /^G-Clock-[\d.]+\.dmg$/i.test(n)),
    linux: (n) => arch === 'x64' && /^G-Clock-[\d.]+\.AppImage$/i.test(n)
  };
  const test = tests[platform];
  return (test && assets.find((a) => test(a.name))) || null;
}
