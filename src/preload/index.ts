import { contextBridge, ipcRenderer } from 'electron'

// ═══════════════════════════════════════════════════════════════
// Context Bridge — Securely exposes IPC methods to renderer
// ═══════════════════════════════════════════════════════════════

const api = {
  // ── Cyclone Engine ──────────────────────────────────────────
  generateGCode: (params: unknown) =>
    ipcRenderer.invoke('cyclone:generate-gcode', params),

  exportGCode: (gcode: string[]) =>
    ipcRenderer.invoke('cyclone:export-gcode', gcode),

  loadWindFile: () =>
    ipcRenderer.invoke('cyclone:load-wind-file'),

  saveWindFile: (params: unknown) =>
    ipcRenderer.invoke('cyclone:save-wind-file', params),

  // ── Serial Port / GRBL ─────────────────────────────────────
  listPorts: () =>
    ipcRenderer.invoke('serial:list-ports'),

  connect: (port: string, baudRate: number) =>
    ipcRenderer.invoke('serial:connect', port, baudRate),

  disconnect: () =>
    ipcRenderer.invoke('serial:disconnect'),

  sendCommand: (cmd: string) =>
    ipcRenderer.invoke('serial:send-command', cmd),

  startStreaming: (gcode: string[]) =>
    ipcRenderer.invoke('serial:start-streaming', gcode),

  // Real-time controls (fire-and-forget, no response needed)
  pause:     () => ipcRenderer.send('serial:pause'),
  resume:    () => ipcRenderer.send('serial:resume'),
  abort:     () => ipcRenderer.send('serial:abort'),
  home:      () => ipcRenderer.send('serial:home'),
  unlock:    () => ipcRenderer.send('serial:unlock'),
  jogCancel: () => ipcRenderer.send('serial:jog-cancel'),
  zeroAxes:  () => ipcRenderer.send('serial:zero-axes'),

  sendSettings: (settings: string[]) =>
    ipcRenderer.send('serial:send-settings', settings),

  jog: (axis: string, distance: number, feedRate: number) =>
    ipcRenderer.send('serial:jog', axis, distance, feedRate),

  motorTest: (axis: string) =>
    ipcRenderer.send('serial:motor-test', axis),

  // ── Event Listeners (main → renderer) ──────────────────────
  // Each returns an unsubscribe function for cleanup
  onSerialData: (callback: (data: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, data: string) => callback(data)
    ipcRenderer.on('serial:data', handler)
    return () => { ipcRenderer.removeListener('serial:data', handler) }
  },

  onGrblStatus: (callback: (status: unknown) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, status: unknown) => callback(status)
    ipcRenderer.on('serial:status', handler)
    return () => { ipcRenderer.removeListener('serial:status', handler) }
  },

  onStreamProgress: (callback: (progress: unknown) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, progress: unknown) => callback(progress)
    ipcRenderer.on('serial:stream-progress', handler)
    return () => { ipcRenderer.removeListener('serial:stream-progress', handler) }
  },

  onConnectionStatus: (callback: (status: unknown) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, status: unknown) => callback(status)
    ipcRenderer.on('serial:connection-status', handler)
    return () => { ipcRenderer.removeListener('serial:connection-status', handler) }
  },

  onSerialError: (callback: (error: string) => void) => {
    const handler = (_e: Electron.IpcRendererEvent, error: string) => callback(error)
    ipcRenderer.on('serial:error', handler)
    return () => { ipcRenderer.removeListener('serial:error', handler) }
  },
}

contextBridge.exposeInMainWorld('cycloneAPI', api)
