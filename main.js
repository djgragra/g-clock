import { app, BrowserWindow, Menu, clipboard, dialog, ipcMain, powerSaveBlocker, screen, session, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { defaults, buildExport, parseImport, parseWebUrl, sanitizePrograms, APP_ID, LIMITS, REPO_LINKS, SUGGESTED_FEEDS } from './src/schema.js';
import { getSettings, updateSettings, replaceSettings, getWindowBounds, setWindowBounds, getNewsCache, setNewsCache } from './src/store.js';
import { createNews } from './src/feeds.js';
import { createWeather, geocode } from './src/weather.js';
import { checkForUpdate, downloadInstaller, REPO } from './src/updater.js';
import { resolveLanguage, resolveLocale, T } from './src/i18n.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const news = createNews({ getSettings, getCache: getNewsCache, setCache: setNewsCache, onUpdate: (s) => send('event:news', s) });
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

handle('settings:export', async () => {
  const res = await dialog.showSaveDialog(mainWindow, {
    title: T('exportTitle'),
    defaultPath: `g-clock-settings-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: T('jsonFilter'), extensions: ['json'] }]
  });
  if (res.canceled || !res.filePath) return { ok: false, canceled: true };
  try {
    fs.writeFileSync(res.filePath, JSON.stringify(buildExport(getSettings()), null, 2), 'utf-8');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

handle('settings:import', async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: T('importTitle'),
    properties: ['openFile'],
    filters: [{ name: T('jsonFilter'), extensions: ['json'] }]
  });
  if (res.canceled || !res.filePaths[0]) return { ok: false, canceled: true };
  try {
    const file = res.filePaths[0];
    if (fs.statSync(file).size > 5_000_000) return { ok: false, error: 'too-large' };
    const next = parseImport(JSON.parse(fs.readFileSync(file, 'utf-8')));
    const prev = getSettings();
    replaceSettings(next);
    afterSettingsChange(prev);
    return { ok: true, ...payload() };
  } catch (err) {
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
    const body = { app: APP_ID, kind: 'programs', exportedAt: new Date().toISOString(), programs: getSettings().programs };
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
    if (parsed && !Array.isArray(parsed) && parsed.app !== undefined && parsed.app !== APP_ID) return { ok: false, error: 'foreign' };
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
  platform: process.platform
}));

// ---- updates (guided, like G-Downloader) ---------------------------------------------------

let lastUpdateInfo = null;
let downloadedInstaller = null;
let installerDownload = null;

async function runUpdateCheck() {
  const info = await checkForUpdate();
  if (info.ok) lastUpdateInfo = info;
  if (info.ok && info.available) send('event:update-available', info);
  return info;
}

handle('update:check', () => runUpdateCheck());

handle('update:download', async () => {
  const info = lastUpdateInfo;
  if (!info?.available) return { ok: false, error: 'no-update' };
  if (downloadedInstaller?.version === info.latest && fs.existsSync(downloadedInstaller.file)) return { ok: true, version: info.latest };
  installerDownload ||= downloadInstaller(info, app.getPath('downloads'), (received, total) => send('event:update-progress', { received, total }))
    .then((file) => {
      downloadedInstaller = { version: info.latest, file };
      return { ok: true, version: info.latest };
    })
    .catch((err) => ({ ok: false, error: err.message }))
    .finally(() => {
      installerDownload = null;
    });
  return installerDownload;
});

handle('update:install', () => {
  const d = downloadedInstaller;
  if (!d || !fs.existsSync(d.file)) return { ok: false, error: 'no-installer' };
  if (process.platform === 'win32') {
    spawn(d.file, [], { detached: true, stdio: 'ignore' }).unref();
    setTimeout(() => app.quit(), 500);
  } else if (process.platform === 'darwin') {
    shell.openPath(d.file);
  } else {
    shell.showItemInFolder(d.file);
  }
  return { ok: true };
});

// ---- lifecycle ---------------------------------------------------------------------------

app.whenReady().then(() => {
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

app.on('window-all-closed', () => app.quit());
