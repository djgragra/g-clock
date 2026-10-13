import { app, BrowserWindow, Menu, clipboard, dialog, ipcMain, net, powerSaveBlocker, screen, session, shell } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defaults, parseWebUrl, sanitizePrograms, isOwnFile, APP_SLUG, LIMITS, REPO_LINKS, SUGGESTED_FEEDS } from './src/schema.js';
import {
  getSettings, updateSettings, replaceSettings, getWindowBounds, setWindowBounds, getNewsCache, setNewsCache,
  getUpdateState, setUpdateState, getLastSeenVersion, setLastSeenVersion, hadSettingsFile, settingsFile
} from './src/store.js';
import { createNews } from './src/feeds.js';
import { createWeather, geocode } from './src/weather.js';
import {
  checkForUpdate, downloadInstaller, sweepPartials, bannerState, remindLaterState, skipVersionState, makeSafetyCopy, installPlan,
  whatsNew, startupKind, REPO
} from './src/updater.js';
import { buildBackup, prepareImport, applyImport, backupFileName, MAX_BACKUP_BYTES } from './src/backup.js';
import { createLogger } from './src/logs.js';
import { buildSupportInfo } from './src/support.js';
import { resolveLanguage, resolveLocale, T } from './src/i18n.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Daily log files (5 MB at most each, 7 days kept). Nothing secret is ever written: G-Clock has none, and no addresses.
const logDir = path.join(app.getPath('userData'), 'logs');
const logger = createLogger({ dir: logDir, prefix: 'g-clock' });
logger.prune();
process.on('uncaughtExceptionMonitor', (err) => logger.log('error', `uncaught: ${err?.message || err}`, 'main'));

// One clock at a time: a second launch just brings the first one forward.
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

let mainWindow = null;
let powerBlockerId = null;

const send = (channel, data) => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, data);
};

// a feed that starts failing is logged once, not at every refresh
const feedFailing = new Set();
const noteFeedStates = (st) => {
  for (const f of st.feeds) {
    if (f.enabled && f.error && !feedFailing.has(f.id)) {
      feedFailing.add(f.id);
      logger.log('warn', `feed "${f.name}" failed: ${f.error}`, 'news');
    } else if (!f.error) feedFailing.delete(f.id);
  }
};
const news = createNews({ getSettings, getCache: getNewsCache, setCache: setNewsCache, onUpdate: (st) => { noteFeedStates(st); send('event:news', st); } });
const weather = createWeather({ getSettings, onUpdate: (s) => send('event:weather', s) });

// ---- window ----------------------------------------------------------------------------

function initialBounds() {
  const b = getWindowBounds();
  const visible = b.x !== undefined && b.y !== undefined && screen.getAllDisplays().some((d) => {
    const w = d.workArea;
    return b.x < w.x + w.width - 40 && b.x + b.width > w.x + 40 && b.y < w.y + w.height - 40 && b.y + b.height > w.y + 40;
  });
  return visible ? b : { width: b.width, height: b.height };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    ...initialBounds(),
    minWidth: 800,
    minHeight: 480,
    show: false,
    title: 'G-Clock',
    backgroundColor: '#0b0b0d',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });

  // The UI is one local page: it never navigates elsewhere and never opens windows.
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (e) => e.preventDefault());
  mainWindow.webContents.on('will-attach-webview', (e) => e.preventDefault());

  mainWindow.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      e.preventDefault();
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    } else if (input.key === 'Escape' && mainWindow.isFullScreen()) {
      e.preventDefault();
      mainWindow.setFullScreen(false);
    }
  });
  mainWindow.on('enter-full-screen', () => send('event:fullscreen', true));
  mainWindow.on('leave-full-screen', () => send('event:fullscreen', false));

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.once('ready-to-show', () => mainWindow.show());

  let boundsTimer = null;
  const persistBounds = () => {
    clearTimeout(boundsTimer);
    boundsTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isFullScreen() && !mainWindow.isMaximized()) setWindowBounds(mainWindow.getBounds());
    }, 400);
  };
  mainWindow.on('resize', persistBounds);
  mainWindow.on('move', persistBounds);
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function lockDownSession() {
  const ses = session.defaultSession;
  ses.setPermissionRequestHandler((_wc, _perm, cb) => cb(false));
  ses.setPermissionCheckHandler(() => false);
  // The page never talks to the network: everything remote goes through the main process.
  // Requests made by the page (they carry a webContentsId) are limited to local content.
  ses.webRequest.onBeforeRequest((details, cb) => {
    const local = /^(file|data|devtools|chrome-extension):/i.test(details.url);
    cb({ cancel: !!details.webContentsId && !local });
  });
}

function buildMenu() {
  // Windows and Linux: no menu bar. macOS needs the standard app menu for Cmd+Q, copy and paste.
  if (process.platform !== 'darwin') {
    Menu.setApplicationMenu(null);
    return;
  }
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: 'appMenu' },
      { role: 'editMenu' },
      { label: 'View', submenu: [{ role: 'togglefullscreen' }, { role: 'minimize' }] },
      { role: 'windowMenu' }
    ])
  );
}

// ---- settings side effects ---------------------------------------------------------------

function applyWindowSettings(s) {
  if (mainWindow) mainWindow.setAlwaysOnTop(s.alwaysOnTop, 'floating');
  const blocking = powerBlockerId !== null && powerSaveBlocker.isStarted(powerBlockerId);
  if (s.keepAwake && !blocking) powerBlockerId = powerSaveBlocker.start('prevent-display-sleep');
  if (!s.keepAwake && blocking) {
    powerSaveBlocker.stop(powerBlockerId);
    powerBlockerId = null;
  }
}

// Network work only restarts when what is fetched changed, not for every edited field.
const sig = (o) => JSON.stringify(o);

function afterSettingsChange(prev) {
  const next = getSettings();
  applyWindowSettings(next);
  if (sig(prev.news) !== sig(next.news)) news.reschedule(sig(prev.news.feeds) !== sig(next.news.feeds) || prev.news.enabled !== next.news.enabled);
  if (sig(prev.weather) !== sig(next.weather)) weather.reschedule(true);
}

const payload = () => ({ settings: getSettings(), lang: resolveLanguage(), locale: resolveLocale(), platform: process.platform, suggestedFeeds: SUGGESTED_FEEDS });

// ---- IPC ---------------------------------------------------------------------------------

// Only our own window may call the main process.
function handle(channel, fn) {
  ipcMain.handle(channel, (event, ...args) => {
    if (!mainWindow || event.sender !== mainWindow.webContents) throw new Error('untrusted sender');
    return fn(...args);
  });
}

handle('settings:get', () => payload());

handle('settings:update', (patch) => {
  const prev = getSettings();
  updateSettings(patch);
  afterSettingsChange(prev);
  return payload();
});

// ---- backup and restore (apps/COMMON-FEATURES.md, section 3) -----------------------------------------

handle('backup:export', async () => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: T('exportTitle'),
    defaultPath: path.join(app.getPath('documents'), backupFileName()),
    filters: [{ name: T('jsonFilter'), extensions: ['json'] }]
  });
  if (res.canceled || !res.filePath) return { ok: false, canceled: true };
  try {
    fs.writeFileSync(res.filePath, JSON.stringify(buildBackup(getSettings()), null, 2), 'utf-8');
    logger.log('info', 'backup exported', 'backup');
    return { ok: true };
  } catch (err) {
    logger.log('error', `backup export failed: ${err.code || err.message}`, 'backup');
    return { ok: false, error: err.message };
  }
});

handle('backup:import', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: T('importTitle'),
    properties: ['openFile'],
    filters: [{ name: T('jsonFilter'), extensions: ['json'] }]
  });
  if (res.canceled || !res.filePaths[0]) return { ok: false, canceled: true };
  try {
    const file = res.filePaths[0];
    if (fs.statSync(file).size > MAX_BACKUP_BYTES) return { ok: false, error: 'too-large' };
    const incoming = prepareImport(JSON.parse(fs.readFileSync(file, 'utf-8')));
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      message: T('importModeMessage'),
      detail: T('importModeDetail'),
      buttons: [T('importReplace'), T('importAdd'), T('cancel')],
      defaultId: 1,
      cancelId: 2
    });
    if (response === 2) return { ok: false, canceled: true };
    const mode = response === 0 ? 'replace' : 'add';
    const prev = getSettings();
    replaceSettings(applyImport(prev, incoming, mode));
    afterSettingsChange(prev);
    logger.log('info', `backup imported (${mode})`, 'backup');
    return { ok: true, mode, mustRetype: [], ...payload() };
  } catch (err) {
    logger.log('warn', `backup import refused: ${err.message === 'foreign' ? 'other app' : 'unreadable'}`, 'backup');
    return { ok: false, error: err.message === 'foreign' ? 'foreign' : 'invalid' };
  }
});

handle('settings:reset', async () => {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    message: T('resetMessage'),
    detail: T('resetDetail'),
    buttons: [T('reset'), T('cancel')],
    defaultId: 1,
    cancelId: 1
  });
  if (response !== 0) return { ok: false, canceled: true };
  const prev = getSettings();
  replaceSettings(defaults());
  afterSettingsChange(prev);
  logger.log('info', 'settings reset to the defaults', 'settings');
  return { ok: true, ...payload() };
});

// ---- recording programs: import / export, report ----------------------------------------------

handle('programs:export', async () => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: T('programsExportTitle'),
    defaultPath: 'g-clock-programs.json',
    filters: [{ name: T('programsFilter'), extensions: ['json'] }]
  });
  if (res.canceled || !res.filePath) return { ok: false, canceled: true };
  try {
    const body = { app: APP_SLUG, kind: 'programs', exportedAt: new Date().toISOString(), programs: getSettings().programs };
    fs.writeFileSync(res.filePath, JSON.stringify(body, null, 2), 'utf-8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// Imported programs are merged with the existing ones: same id = replaced, others kept.
handle('programs:import', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: T('programsImportTitle'),
    properties: ['openFile'],
    filters: [{ name: T('programsFilter'), extensions: ['json'] }]
  });
  if (res.canceled || !res.filePaths[0]) return { ok: false, canceled: true };
  try {
    const file = res.filePaths[0];
    if (fs.statSync(file).size > 5_000_000) return { ok: false, error: 'invalid' };
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (parsed && !Array.isArray(parsed) && !isOwnFile(parsed.app)) return { ok: false, error: 'foreign' };
    const incoming = sanitizePrograms(Array.isArray(parsed) ? parsed : parsed?.programs);
    if (!incoming.length) return { ok: false, error: 'invalid' };
    const byId = new Map(getSettings().programs.map((p) => [p.id, p]));
    for (const p of incoming) byId.set(p.id, p);
    updateSettings({ programs: [...byId.values()].slice(0, LIMITS.programs) });
    return { ok: true, ...payload() };
  } catch {
    return { ok: false, error: 'invalid' };
  }
});

handle('report:save', async (name, text) => {
  if (typeof text !== 'string' || text.length > 200_000) return { ok: false, error: 'invalid' };
  const base = String(name || 'report').replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 60) || 'report';
  const res = await dialog.showSaveDialog(mainWindow, {
    title: T('reportTitle'),
    defaultPath: `report-${base}.txt`,
    filters: [{ name: T('txtFilter'), extensions: ['txt'] }]
  });
  if (res.canceled || !res.filePath) return { ok: false, canceled: true };
  try {
    fs.writeFileSync(res.filePath, text, 'utf-8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

handle('clipboard:write', (text) => {
  if (typeof text !== 'string' || text.length > 200_000) return { ok: false };
  clipboard.writeText(text);
  return { ok: true };
});

handle('news:get', () => news.state());
handle('news:refresh', async () => {
  await news.refresh();
  return news.state();
});

handle('weather:get', () => weather.state());
handle('weather:geocode', async (query) => {
  try {
    return { ok: true, results: await geocode(query, resolveLanguage()) };
  } catch (err) {
    return { ok: false, error: err.name === 'TimeoutError' ? 'timeout' : String(err.message || err).slice(0, 80) };
  }
});

handle('window:toggle-fullscreen', () => {
  mainWindow.setFullScreen(!mainWindow.isFullScreen());
  return mainWindow.isFullScreen();
});

// A link opens in the system browser only if it is one the user configured (buttons), one that
// is in the current headlines, or one of the fixed project addresses.
function allowedExternal(url) {
  if (typeof url !== 'string' || !parseWebUrl(url)) return false;
  if (REPO_LINKS.includes(url) || url.startsWith(`https://github.com/${REPO}/releases/`)) return true;
  return getSettings().links.some((l) => l.url === url) || news.state().items.some((n) => n.link === url);
}
handle('links:open', async (url) => {
  if (!allowedExternal(url)) return { ok: false };
  await shell.openExternal(url);
  return { ok: true };
});

handle('app:info', () => ({
  name: 'G-Clock',
  version: app.getVersion(),
  electron: process.versions.electron,
  platform: process.platform,
  arch: process.arch
}));

// Version, system, language, last update check and last error. Never settings values or file names.
handle('app:support-info', () =>
  buildSupportInfo({
    app: 'G-Clock',
    version: app.getVersion(),
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    platform: process.platform,
    arch: process.arch,
    osRelease: os.release(),
    language: resolveLanguage(),
    lastCheck: getUpdateState().lastCheck,
    lastError: logger.entries().filter((e) => e.level === 'error').at(-1),
    home: os.homedir()
  }));

handle('logs:open', async () => {
  fs.mkdirSync(logDir, { recursive: true });
  const err = await shell.openPath(logDir);
  return { ok: !err };
});

// ---- guided update (apps/COMMON-FEATURES.md, section 4) --------------------------------------------------

let lastUpdateInfo = null;
let downloadedInstaller = null; // { version, file }
let installerDownload = null;
let downloadAbort = null;
let startKind = 'same';

const downloadsDir = () => app.getPath('downloads');

// What the page may see of a check: no download URLs, only what it needs to draw the notice.
const publicInfo = (info) =>
  info && {
    ok: info.ok,
    current: info.current,
    latest: info.latest,
    available: !!info.available,
    url: info.url,
    notes: info.notes || '',
    canInstall: !!(info.installer && info.sumsUrl),
    installerName: info.installer?.name || '',
    error: info.ok ? '' : String(info.error || '')
  };

function updateView(info) {
  const ready = downloadedInstaller && info?.available && downloadedInstaller.version === info.latest && fs.existsSync(downloadedInstaller.file);
  return {
    info: publicInfo(info),
    banner: bannerState(info, getUpdateState()),
    lastCheck: getUpdateState().lastCheck,
    downloading: !!installerDownload,
    downloaded: ready ? path.basename(downloadedInstaller.file) : null
  };
}

async function runUpdateCheck({ manual = false } = {}) {
  const info = await checkForUpdate({ current: app.getVersion(), fetchFn: net.fetch });
  if (info.ok) lastUpdateInfo = info;
  setUpdateState({ lastCheck: { at: Date.now(), ok: !!info.ok, error: info.ok ? '' : String(info.error || '').slice(0, 200) } });
  logger.log(info.ok ? 'info' : 'warn', info.ok ? `update check: ${info.available ? `${info.latest} available` : 'up to date'}` : `update check failed: ${info.error}`, 'update');
  const view = updateView(info);
  if (!manual && view.banner === 'show') send('event:update-available', view);
  return view;
}

handle('update:check', () => runUpdateCheck({ manual: true }));
handle('update:status', () => updateView(lastUpdateInfo));

handle('update:download', async () => {
  const info = lastUpdateInfo;
  if (!info?.available) return { ok: false, error: 'no-update' };
  if (downloadedInstaller?.version === info.latest && fs.existsSync(downloadedInstaller.file)) return { ok: true, version: info.latest };
  if (!installerDownload) {
    // a .part left by a download that was cut off earlier goes first
    sweepPartials(downloadsDir());
    downloadAbort = new AbortController();
    installerDownload = downloadInstaller({
      info,
      dir: downloadsDir(),
      fetchFn: net.fetch,
      current: app.getVersion(),
      signal: downloadAbort.signal,
      onProgress: (received, total) => send('event:update-progress', { received, total })
    })
      .then((file) => {
        downloadedInstaller = { version: info.latest, file };
        logger.log('info', `update ${info.latest} downloaded and verified (SHA-256)`, 'update');
        return { ok: true, version: info.latest };
      })
      .catch((err) => {
        if (!err.cancelled) logger.log('warn', `update download failed: ${err.message}`, 'update');
        return { ok: false, error: err.message };
      })
      .finally(() => {
        installerDownload = null;
        downloadAbort = null;
      });
  }
  return installerDownload;
});

handle('update:cancel', () => {
  downloadAbort?.abort();
  return true;
});
handle('update:remind', () => {
  setUpdateState(remindLaterState(getUpdateState()));
  return updateView(lastUpdateInfo);
});
handle('update:skip', () => {
  setUpdateState(skipVersionState(getUpdateState(), lastUpdateInfo?.latest));
  return updateView(lastUpdateInfo);
});

// "Close and install": a safety copy of the settings first. The page says if the recording timer is running, and
// then the user is asked before the app closes (nothing else in G-Clock can be lost by closing it).
handle('update:install', async (opts) => {
  const d = downloadedInstaller;
  if (!d || !fs.existsSync(d.file)) return { ok: false, error: 'no-installer' };
  if (opts?.busy) {
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'warning',
      message: T('installBusyMessage'),
      detail: T('installBusyDetail'),
      buttons: [T('installAnyway'), T('cancel')],
      defaultId: 1,
      cancelId: 1
    });
    if (response !== 0) return { ok: false, error: 'busy' };
  }
  try {
    makeSafetyCopy({ file: settingsFile(), dir: path.join(app.getPath('userData'), 'backups'), version: lastUpdateInfo?.current || app.getVersion() });
  } catch (err) {
    logger.log('error', `safety copy failed: ${err.code || err.message}`, 'update');
    return { ok: false, error: 'safety-copy' };
  }
  const plan = installPlan(process.platform, d.file);
  logger.log('info', `installing update ${d.version} (${plan.kind})`, 'update');
  if (plan.kind === 'run-installer') {
    spawn(plan.file, [], { detached: true, stdio: 'ignore' }).unref();
    setTimeout(() => app.quit(), 500);
  } else if (plan.kind === 'open-image') {
    await shell.openPath(plan.file);
  } else {
    shell.showItemInFolder(plan.file);
  }
  return { ok: true, hint: plan.hint || '' };
});

// After an update: the bullets of this version from the bundled CHANGELOG.md, shown once.
handle('whatsnew:get', () => {
  if (startKind !== 'updated') return null;
  try {
    return whatsNew(fs.readFileSync(path.join(__dirname, 'CHANGELOG.md'), 'utf-8'), app.getVersion());
  } catch {
    return null;
  }
});
handle('whatsnew:seen', () => {
  startKind = 'same';
  setLastSeenVersion(app.getVersion());
  return true;
});

// ---- lifecycle ---------------------------------------------------------------------------

app.whenReady().then(() => {
  startKind = startupKind(getLastSeenVersion(), app.getVersion(), hadSettingsFile);
  if (startKind === 'first') setLastSeenVersion(app.getVersion());
  logger.log('info', `G-Clock ${app.getVersion()} started (${process.platform} ${process.arch}, ${startKind})`, 'app');
  const stale = sweepPartials(downloadsDir());
  if (stale.length) logger.log('info', `removed ${stale.length} unfinished installer download(s) left by an earlier run`, 'update');
  lockDownSession();
  buildMenu();
  createWindow();
  applyWindowSettings(getSettings());
  news.start();
  weather.start();
  if (getSettings().checkUpdates) {
    setTimeout(runUpdateCheck, 15_000);
    setInterval(runUpdateCheck, 24 * 3600_000);
  }
});

// closing the app in the middle of a download: stop it, so the .part is deleted (what is left is swept at the next start)
app.on('before-quit', () => downloadAbort?.abort());
app.on('window-all-closed', () => app.quit());
