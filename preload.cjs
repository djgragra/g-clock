const { contextBridge, ipcRenderer } = require('electron');

// The only door between the page and the main process: explicit, named channels.
contextBridge.exposeInMainWorld('api', {
  platform: process.platform,
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (patch) => ipcRenderer.invoke('settings:update', patch),
    export: () => ipcRenderer.invoke('settings:export'),
    import: () => ipcRenderer.invoke('settings:import'),
    reset: () => ipcRenderer.invoke('settings:reset')
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
  app: {
    info: () => ipcRenderer.invoke('app:info')
  },
  updates: {
    check: () => ipcRenderer.invoke('update:check'),
    download: () => ipcRenderer.invoke('update:download'),
    install: () => ipcRenderer.invoke('update:install')
  },
  on: {
    news: (cb) => ipcRenderer.on('event:news', (_e, data) => cb(data)),
    weather: (cb) => ipcRenderer.on('event:weather', (_e, data) => cb(data)),
    fullscreen: (cb) => ipcRenderer.on('event:fullscreen', (_e, on) => cb(on)),
    updateAvailable: (cb) => ipcRenderer.on('event:update-available', (_e, data) => cb(data)),
    updateProgress: (cb) => ipcRenderer.on('event:update-progress', (_e, data) => cb(data))
  }
});
