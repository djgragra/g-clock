const { contextBridge, ipcRenderer } = require('electron');

// The only door between the page and the main process: explicit, named channels.
contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (patch) => ipcRenderer.invoke('settings:update', patch),
    reset: () => ipcRenderer.invoke('settings:reset')
  },
  backup: {
    export: () => ipcRenderer.invoke('backup:export'),
    import: () => ipcRenderer.invoke('backup:import')
  },
  programs: {
    export: () => ipcRenderer.invoke('programs:export'),
    import: () => ipcRenderer.invoke('programs:import')
  },
  report: {
    save: (name, text, format) => ipcRenderer.invoke('report:save', name, text, format)
  },
  clipboard: {
    write: (text) => ipcRenderer.invoke('clipboard:write', text)
  },
  news: {
    get: () => ipcRenderer.invoke('news:get'),
    refresh: () => ipcRenderer.invoke('news:refresh')
  },
  weather: {
    get: () => ipcRenderer.invoke('weather:get'),
    geocode: (query) => ipcRenderer.invoke('weather:geocode', query)
  },
  window: {
    toggleFullscreen: () => ipcRenderer.invoke('window:toggle-fullscreen')
  },
  links: {
    open: (url) => ipcRenderer.invoke('links:open', url)
  },
  keys: {
    status: () => ipcRenderer.invoke('keys:status'),
    // lets the main process stop the global shortcuts while the user is choosing a new key
    capture: (on) => ipcRenderer.invoke('keys:capture', !!on)
  },
  talk: {
    setProgramIndex: (id, index) => ipcRenderer.invoke('talk:index-set', id, index)
  },
  app: {
    log: (level, message) => ipcRenderer.invoke('app:log', level, message),
    info: () => ipcRenderer.invoke('app:info'),
    supportInfo: () => ipcRenderer.invoke('app:support-info'),
    openLogs: () => ipcRenderer.invoke('logs:open')
  },
  updates: {
    status: () => ipcRenderer.invoke('update:status'),
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    cancel: () => ipcRenderer.invoke('update:cancel'),
    remind: () => ipcRenderer.invoke('update:remind'),
    skip: () => ipcRenderer.invoke('update:skip'),
    install: (opts) => ipcRenderer.invoke('update:install', opts)
  },
  whatsNew: {
    get: () => ipcRenderer.invoke('whatsnew:get'),
    seen: () => ipcRenderer.invoke('whatsnew:seen')
  },
  on: {
    news: (cb) => ipcRenderer.on('event:news', (_e, data) => cb(data)),
    weather: (cb) => ipcRenderer.on('event:weather', (_e, data) => cb(data)),
    signal: (cb) => ipcRenderer.on('event:signal', (_e, data) => cb(data)),
    keyStatus: (cb) => ipcRenderer.on('event:key-status', (_e, data) => cb(data)),
    fullscreen: (cb) => ipcRenderer.on('event:fullscreen', (_e, on) => cb(on)),
    updateAvailable: (cb) => ipcRenderer.on('event:update-available', (_e, data) => cb(data)),
    updateProgress: (cb) => ipcRenderer.on('event:update-progress', (_e, data) => cb(data))
  }
});
