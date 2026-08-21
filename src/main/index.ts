import { app, BrowserWindow, shell } from 'electron'
import path from 'path'
import { registerIpcHandlers, cleanupIpcHandlers } from './ipc-handlers'

// Disable GPU shader disk cache to avoid Windows permission error (0x5)
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
app.commandLine.appendSwitch('disable-http-cache')

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const iconPath = path.join(__dirname, '../../resources/icon.png')

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    backgroundColor: '#0a0e17',
    title: 'CCTE CNC — Filament Winder Controller',
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for serialport native module access
    },
    autoHideMenuBar: true,
    show: false,
  })

  // Smooth appearance — show after content is ready
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // Open external links in the system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Load the renderer — HMR dev server or production build
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  cleanupIpcHandlers()
  app.quit()
})
