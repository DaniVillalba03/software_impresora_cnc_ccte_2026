// ═══════════════════════════════════════════════════════════════
// IPC Handlers — Registry for all main ↔ renderer communication
// ═══════════════════════════════════════════════════════════════

import { ipcMain, dialog, BrowserWindow } from 'electron'
import { promises as fs } from 'fs'
import { generateGCode } from './cyclone-adapter'
import { GrblController } from './grbl-controller'

const grbl = new GrblController()

// ── Helpers ──────────────────────────────────────────────────

function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows()
  return windows.length > 0 ? windows[0] : null
}

function sendToRenderer(channel: string, ...args: unknown[]): void {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, ...args)
  }
}

// ── Registration ─────────────────────────────────────────────

export function registerIpcHandlers(): void {
  // ─── Cyclone Engine ──────────────────────────────────────────

  ipcMain.handle('cyclone:generate-gcode', async (_event, params) => {
    try {
      return generateGCode(params)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new Error(`G-Code generation failed: ${msg}`)
    }
  })

  ipcMain.handle('cyclone:export-gcode', async (_event, gcode: string[]) => {
    const win = getMainWindow()
    if (!win) return null

    const result = await dialog.showSaveDialog(win, {
      title: 'Exportar G-Code',
      defaultPath: 'winding.gcode',
      filters: [
        { name: 'G-Code Files', extensions: ['gcode', 'nc', 'ngc'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    })
    if (result.canceled || !result.filePath) return null
    await fs.writeFile(result.filePath, gcode.join('\n'), 'utf-8')
    return result.filePath
  })

  ipcMain.handle('cyclone:load-wind-file', async () => {
    const win = getMainWindow()
    if (!win) return null

    const result = await dialog.showOpenDialog(win, {
      title: 'Cargar Receta de Bobinado',
      filters: [
        { name: 'Wind Files', extensions: ['wind', 'json'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const content = await fs.readFile(result.filePaths[0], 'utf-8')
    return JSON.parse(content)
  })

  ipcMain.handle('cyclone:save-wind-file', async (_event, params) => {
    const win = getMainWindow()
    if (!win) return null

    const result = await dialog.showSaveDialog(win, {
      title: 'Guardar Receta de Bobinado',
      defaultPath: 'recipe.wind',
      filters: [
        { name: 'Wind Files', extensions: ['wind'] },
        { name: 'JSON Files', extensions: ['json'] },
      ],
    })
    if (result.canceled || !result.filePath) return null
    await fs.writeFile(result.filePath, JSON.stringify(params, null, 2), 'utf-8')
    return result.filePath
  })

  // ─── Serial Port / GRBL ─────────────────────────────────────

  ipcMain.handle('serial:list-ports', async () => {
    return grbl.listPorts()
  })

  ipcMain.handle('serial:connect', async (_event, port: string, baudRate: number) => {
    await grbl.connect(port, baudRate)
  })

  ipcMain.handle('serial:disconnect', async () => {
    await grbl.disconnect()
  })

  ipcMain.handle('serial:send-command', async (_event, cmd: string) => {
    grbl.sendImmediate(cmd)
  })

  ipcMain.handle('serial:start-streaming', async (_event, gcode: string[]) => {
    grbl.startStreaming(gcode)
  })

  // Real-time controls (fire-and-forget via ipcMain.on)
  ipcMain.on('serial:pause', () => grbl.pauseStream())
  ipcMain.on('serial:resume', () => grbl.resumeStream())
  ipcMain.on('serial:abort', () => grbl.abortStream())
  ipcMain.on('serial:home', () => grbl.home())
  ipcMain.on('serial:unlock', () => grbl.unlock())
  ipcMain.on('serial:jog-cancel', () => grbl.jogCancel())

  ipcMain.on('serial:jog', (_event, axis: string, distance: number, feedRate: number) => {
    grbl.jog(axis, distance, feedRate)
  })

  // ─── Forward GRBL events to renderer ─────────────────────────

  grbl.on('data', (data) => sendToRenderer('serial:data', data))
  grbl.on('status', (status) => sendToRenderer('serial:status', status))
  grbl.on('stream-progress', (progress) => sendToRenderer('serial:stream-progress', progress))
  grbl.on('connection-status', (status) => sendToRenderer('serial:connection-status', status))
  grbl.on('error', (error) => sendToRenderer('serial:error', error))
  grbl.on('alarm', (alarm) => sendToRenderer('serial:data', alarm))
}

// ── Cleanup ──────────────────────────────────────────────────

export function cleanupIpcHandlers(): void {
  grbl.disconnect().catch(() => {})
}
