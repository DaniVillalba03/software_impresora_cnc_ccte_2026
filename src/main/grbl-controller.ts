// ═══════════════════════════════════════════════════════════════
// GRBL Controller — Serial communication with Arduino CNC Shield
// Implements the GRBL character-counting streaming protocol
// ═══════════════════════════════════════════════════════════════

import { SerialPort, ReadlineParser } from 'serialport'
import { EventEmitter } from 'events'

export class GrblController extends EventEmitter {
  private port: SerialPort | null = null
  private parser: ReadlineParser | null = null
  private _isConnected = false

  // ── Streaming State ──────────────────────────────────────────
  private streamQueue: string[] = []
  private isStreaming = false
  private isPaused = false
  private streamSentIndex = 0
  private streamAckedCount = 0
  private streamTotal = 0
  private streamStartTime = 0

  // ── Character-Counting Protocol ──────────────────────────────
  // GRBL has a 128-byte RX buffer. We track bytes sent and freed
  // to maximize throughput while avoiding buffer overflow.
  private readonly RX_BUFFER_SIZE = 128
  private sentLengths: number[] = []
  private bufferUsage = 0

  // ── Status Polling ───────────────────────────────────────────
  private statusInterval: ReturnType<typeof setInterval> | null = null

  // ── Connection handshake ─────────────────────────────────────
  // Callback invoked once GRBL sends its welcome banner after reset.
  private _onGrblReady: (() => void) | null = null
  private _connectTimeout: ReturnType<typeof setTimeout> | null = null
  private _readyDebounceTimeout: ReturnType<typeof setTimeout> | null = null
  private _initialConfigDone = false
  private _isConfiguring = false

  get isConnected(): boolean {
    return this._isConnected
  }

  /** List available serial ports */
  async listPorts() {
    return SerialPort.list()
  }

  /** Connect to GRBL controller */
  async connect(portPath: string, baudRate = 115200): Promise<void> {
    if (this._isConnected) {
      await this.disconnect()
    }

    return new Promise((resolve, reject) => {
      this.port = new SerialPort({
        path: portPath,
        baudRate,
        autoOpen: false,
      })

      this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }))
      this.parser.on('data', (line: string) => this.handleResponse(line.trim()))

      this.port.on('error', (err) => {
        this.emit('error', err.message)
      })

      this.port.on('close', () => {
        this._isConnected = false
        this.stopStatusPolling()
        this._onGrblReady = null
        if (this._connectTimeout) {
          clearTimeout(this._connectTimeout)
          this._connectTimeout = null
        }
        if (this._readyDebounceTimeout) {
          clearTimeout(this._readyDebounceTimeout)
          this._readyDebounceTimeout = null
        }
        this._initialConfigDone = false
        this._isConfiguring = false
        this.emit('connection-status', { connected: false, port: portPath, baudRate })
      })

      this.port.open((error) => {
        if (error) {
          return reject(new Error(`Error opening port: ${error.message}`))
        }
        this._isConnected = true
        this._initialConfigDone = false
        this._isConfiguring = false
        this.resetStreamState()
        this.emit('connection-status', { connected: true, port: portPath, baudRate })

        // Register callback: when GRBL sends its welcome banner,
        // we know it's ready to accept settings.
        this._onGrblReady = () => {
          this.sendSettingsSequential(this.SAFE_GRBL_SETTINGS, () => {
            this._initialConfigDone = true
            this.emit('data', '[INFO] Configuración GRBL para DRV8825 enviada')
            setTimeout(() => {
              this.sendImmediate('$X')
              this.startStatusPolling()
              resolve()
            }, 100)
          })
        }

        // Send soft reset ONLY if GRBL hasn't responded yet.
        // Opening the serial port toggles DTR which resets the Arduino,
        // so the banner usually arrives before 1500ms. Only if it doesn't
        // (e.g. Arduino was already running) do we force a reset.
        setTimeout(() => {
          if (this._onGrblReady) {
            this.softReset()
          }
        }, 1500)

        // Fallback: if GRBL never sends its welcome banner (e.g. it
        // was already running), proceed after 5 seconds.
        this._connectTimeout = setTimeout(() => {
          if (this._onGrblReady) {
            const cb = this._onGrblReady
            this._onGrblReady = null
            cb()
          }
        }, 5000)
      })
    })
  }

  // ── GRBL Configuration for DRV8825 on CNC Shield V3 ────────

  /**
   * Safe GRBL settings for DRV8825 drivers on CNC Shield V3.
   * These prevent motor stalling, overheating, and excessive current draw.
   */
  private readonly SAFE_GRBL_SETTINGS: string[] = [
    '$0=10',      // Step pulse duration (µs) — DRV8825 needs ≥1.9µs, 10 is safe
    '$1=25',      // Step idle delay (ms) — disable motors quickly after idle
    // (255 = always on → draws constant current → Arduino brownout)
    '$3=0',       // Direction invert mask — normal (00000000)
    '$4=0',       // Step enable invert — normal (active low for CNC Shield)
    '$5=0',       // Limit pins invert — normal
    '$6=0',       // Probe pin invert — normal
    '$20=0',      // Soft limits — disabled (no homing reference yet)
    '$21=0',      // Hard limits — disabled (avoid false alarms from noise)
    '$22=0',      // Homing cycle — disabled by default
    '$100=0.556',    // X steps/deg (full step: 200 steps/rev ÷ 360°)
    '$101=0.556',    // Y steps/deg
    '$102=0.556',    // Z steps/deg
    '$110=2000.000', // X max rate (deg/min) — ~5.5 RPM
    '$111=2000.000', // Y max rate (deg/min)
    '$112=2000.000', // Z max rate (deg/min)
    '$120=100.000',  // X acceleration (deg/s²)
    '$121=100.000',  // Y acceleration (deg/s²)
    '$122=100.000',  // Z acceleration (deg/s²)
  ]

  /**
   * Send an array of GRBL settings sequentially, waiting for 'ok' (or error)
   * from GRBL after each setting before sending the next one.
   * EEPROM writes block the microcontroller; without handshake, settings like
   * $1=25 are dropped or corrupted with 'error: Invalid statement'.
   */
  private sendSettingsSequential(settings: string[], callback?: () => void): void {
    if (!this.port?.isOpen || settings.length === 0) {
      this._isConfiguring = false
      callback?.()
      return
    }
    if (this._isConfiguring) {
      return
    }
    this._isConfiguring = true
    let i = 0

    const sendCurrent = () => {
      if (i >= settings.length || !this.port?.isOpen) {
        this._isConfiguring = false
        callback?.()
        return
      }
      const cmd = settings[i]
      this.port.write(cmd + '\n')

      let handled = false
      const onResponse = (data: string) => {
        if (!handled && (data === 'ok' || data.startsWith('error:'))) {
          handled = true
          this.removeListener('data', onResponse)
          i++
          // Small 30ms breather after EEPROM write
          setTimeout(sendCurrent, 30)
        }
      }
      this.on('data', onResponse)

      // Fallback timeout in case no response within 1000ms
      setTimeout(() => {
        if (!handled) {
          handled = true
          this.removeListener('data', onResponse)
          i++
          sendCurrent()
        }
      }, 1000)
    }

    sendCurrent()
  }

  /** Send custom GRBL settings from the UI */
  sendSettings(settings: string[]): void {
    if (this._isConfiguring) {
      this.emit('data', '[WARN] Esperando configuración anterior...')
      return
    }
    const filtered = settings
      .map((s) => s.trim())
      .filter((s) => s.startsWith('$') && s.includes('='))

    this.sendSettingsSequential(filtered, () => {
      this.emit('data', '[INFO] Configuración GRBL personalizada enviada')
    })
  }

  /** Disconnect from GRBL controller */
  async disconnect(): Promise<void> {
    this.stopStatusPolling()
    this.resetStreamState()
    if (this._readyDebounceTimeout) {
      clearTimeout(this._readyDebounceTimeout)
      this._readyDebounceTimeout = null
    }
    this._onGrblReady = null
    this._initialConfigDone = false
    this._isConfiguring = false

    return new Promise((resolve) => {
      if (!this.port || !this.port.isOpen) {
        this._isConnected = false
        resolve()
        return
      }
      this.port.close(() => {
        this._isConnected = false
        this.port = null
        this.parser = null
        resolve()
      })
    })
  }

  // ── Real-Time Commands (bypass serial buffer) ────────────────

  /** Feed hold — immediately pause motion */
  feedHold(): void {
    if (!this.port?.isOpen) return
    this.port.write('!')
    this.isPaused = true
  }

  /** Cycle resume — continue after feed hold */
  cycleResume(): void {
    if (!this.port?.isOpen) return
    this.port.write('~')
    this.isPaused = false
    if (this.isStreaming) this.sendNextCommands()
  }

  /** Soft reset — emergency stop, clears all state */
  softReset(): void {
    if (!this.port?.isOpen) return
    this.port.write(Buffer.from([0x18]))
    this.resetStreamState()
  }

  /** Query current status */
  statusQuery(): void {
    if (!this.port?.isOpen) return
    this.port.write('?')
  }

  // ── Jogging ──────────────────────────────────────────────────

  /** Send jog motion command.
   *  Uses standard G91 G0 motion which works reliably across all GRBL
   *  firmware versions and avoids modal/travel-limit lockouts of $J=. */
  jog(axis: string, distance: number, _feedRate?: number): void {
    if (!this.port?.isOpen) return
    if (this._isConfiguring) {
      this.emit('data', '[WARN] Esperando configuración GRBL...')
      return
    }
    const cmd = `G91 G0 ${axis}${distance}`
    this.emit('data', `[JOG] Enviando: ${cmd}`)
    this.sendImmediate(cmd)
  }

  /**
   * Motor diagnostic test — tests BOTH directions (forward and reverse).
   * Moves 90° forward @ F1500, dwells 1s, then 90° backward @ F1500.
   * Commands are sent sequentially (waiting for 'ok' between each).
   */
  motorTest(axis: string): void {
    if (!this.port?.isOpen) return
    this.sendImmediate('$X')

    this.emit('data', `[TEST] Motor ${axis} → Adelante 90°, luego Atrás 90° @ F1500`)

    setTimeout(() => {
      const commands = [
        'G91',                        // Incremental mode
        `G1 ${axis}90 F1500`,         // Forward 90°
        'G4 P1',                      // Dwell 1s
        `G1 ${axis}-90 F1500`,        // Backward 90°
      ]
      this.sendSettingsSequential(commands, () => {
        this.emit('data', `[TEST] Motor ${axis} completado`)
      })
    }, 300)
  }

  /** Cancel active jog — sends 0x85 real-time jog cancel (GRBL 1.1h) */
  jogCancel(): void {
    if (!this.port?.isOpen) return
    this.port.write(Buffer.from([0x85]))
  }

  /** Home cycle */
  home(): void {
    this.sendImmediate('$H')
  }

  /** Unlock after alarm */
  unlock(): void {
    this.sendImmediate('$X')
  }

  // ── Zero Work Coordinates ─────────────────────────────────────

  /** Zero all work coordinates: sends G92 X0 Y0 Z0, waits for 'ok',
   *  then forces an immediate status query to sync the DRO. */
  zeroWorkCoordinates(): void {
    if (!this.port?.isOpen) return

    // Listen for the next 'ok' to know when G92 has been accepted
    const onAck = (data: string): void => {
      if (data === 'ok') {
        this.removeListener('data', onAck)

        // Immediately query status so GRBL reports the new WPos
        this.statusQuery()

        // Also emit a synthetic zeroed status so the UI updates instantly
        // (the real '?' response will confirm moments later)
        this.emit('status', {
          state: 'Idle',
          wpos: { x: 0, y: 0, z: 0 },
        })
      }
    }
    this.on('data', onAck)

    // Send the full G92 command with all axes
    this.sendImmediate('G92 X0 Y0 Z0')
  }

  /** Move all axes to the origin (0,0,0) at a safe speed */
  goToOrigin(feedRate = 500): void {
    if (!this.port?.isOpen) return
    this.emit('data', '[INFO] Moviendo al origen (0,0,0)...')
    this.sendImmediate('G90')
    this.sendImmediate(`G1 X0 Y0 Z0 F${feedRate}`)
  }

  // ── Immediate Command ────────────────────────────────────────

  /** Send a single command immediately (not part of streaming) */
  sendImmediate(cmd: string): void {
    if (!this.port?.isOpen) return
    this.port.write(cmd + '\n')
  }

  // ── Streaming ────────────────────────────────────────────────

  /** Start streaming G-code with character-counting protocol */
  startStreaming(gcode: string[]): void {
    const cleaned = gcode.filter((line) => {
      const trimmed = line.trim()
      return trimmed.length > 0 && !trimmed.startsWith(';')
    })

    // Safety preamble: always ensure absolute coordinates and metric units
    const preamble: string[] = []
    if (!cleaned[0]?.startsWith('G21')) preamble.push('G21')
    if (!cleaned.some((l) => l.startsWith('G90'))) preamble.push('G90')

    this.streamQueue = [...preamble, ...cleaned]
    this.streamSentIndex = 0
    this.streamAckedCount = 0
    this.streamTotal = this.streamQueue.length
    this.isStreaming = true
    this.isPaused = false
    this.streamStartTime = Date.now()
    this.sentLengths = []
    this.bufferUsage = 0

    this.sendNextCommands()
  }

  /** Pause streaming (GRBL feed hold) */
  pauseStream(): void {
    this.feedHold()
  }

  /** Resume streaming (GRBL cycle resume) */
  resumeStream(): void {
    this.cycleResume()
  }

  /** Abort streaming (GRBL soft reset) */
  abortStream(): void {
    this.softReset()
    this.emit('stream-progress', {
      currentLine: this.streamAckedCount,
      totalLines: this.streamTotal,
      percent: 100,
      elapsedS: (Date.now() - this.streamStartTime) / 1000,
      complete: true,
    })
  }

  // ── Private: Character-Counting Streaming Protocol ───────────

  private sendNextCommands(): void {
    if (!this.port?.isOpen || !this.isStreaming || this.isPaused) return

    while (this.streamSentIndex < this.streamQueue.length) {
      const cmd = this.streamQueue[this.streamSentIndex]
      const cmdLen = cmd.length + 1 // +1 for \n

      // Check if there's room in GRBL's RX buffer
      if (this.bufferUsage + cmdLen > this.RX_BUFFER_SIZE) {
        break // Buffer full, wait for 'ok' acknowledgment
      }

      this.port.write(cmd + '\n')
      this.sentLengths.push(cmdLen)
      this.bufferUsage += cmdLen
      this.streamSentIndex++
    }

    this.emitProgress()
  }

  // ── Private: Response Handler ────────────────────────────────

  private handleResponse(line: string): void {
    if (line === 'ok') {
      // Free buffer space for the oldest unacknowledged command
      if (this.sentLengths.length > 0) {
        this.bufferUsage -= this.sentLengths.shift()!
      }

      this.emit('data', 'ok')

      if (this.isStreaming) {
        this.streamAckedCount++
        this.emitProgress()

        if (this.streamAckedCount >= this.streamTotal) {
          // All commands acknowledged
          this.isStreaming = false
          this.emit('stream-progress', {
            currentLine: this.streamTotal,
            totalLines: this.streamTotal,
            percent: 100,
            elapsedS: (Date.now() - this.streamStartTime) / 1000,
            complete: true,
          })
        } else {
          this.sendNextCommands()
        }
      }
      return
    }

    if (line.startsWith('error:')) {
      if (this.sentLengths.length > 0) {
        this.bufferUsage -= this.sentLengths.shift()!
      }
      this.emit('data', line)
      this.emit('error', line)

      if (this.isStreaming) {
        this.streamAckedCount++
        this.sendNextCommands()
      }
      return
    }

    if (line.startsWith('ALARM:')) {
      this.emit('data', line)
      this.emit('alarm', line)
      this.resetStreamState()
      return
    }

    // Status report: <Idle|WPos:0.000,0.000,0.000|Buf:15,128>
    if (line.startsWith('<') && line.endsWith('>')) {
      this.parseStatusReport(line)
      return
    }

    // GRBL welcome banner — means GRBL just booted (initial connect or reset)
    if (line.startsWith('Grbl')) {
      this.emit('data', line)

      // Initial connection: wait for boot banners to settle before configuring
      if (!this._initialConfigDone) {
        if (this._connectTimeout) {
          clearTimeout(this._connectTimeout)
          this._connectTimeout = null
        }
        if (this._readyDebounceTimeout) {
          clearTimeout(this._readyDebounceTimeout)
        }
        this._readyDebounceTimeout = setTimeout(() => {
          this._readyDebounceTimeout = null
          if (this._onGrblReady) {
            const cb = this._onGrblReady
            this._onGrblReady = null
            cb()
          }
        }, 400)
        return
      }

      // Mid-session reboot (Arduino brownout / reset AFTER initial connect has finished)
      if (this._isConnected && !this._isConfiguring) {
        this.emit('data', '[WARN] Arduino se reinició — reenviando configuración')
        this.resetStreamState()
        this.sendSettingsSequential(this.SAFE_GRBL_SETTINGS, () => {
          this.emit('data', '[INFO] Configuración GRBL para DRV8825 reenviada')
        })
      }
      return
    }

    // Welcome message, version, settings, etc.
    this.emit('data', line)
  }

  // ── Private: Status Report Parser ────────────────────────────

  private parseStatusReport(report: string): void {
    const inner = report.slice(1, -1)
    const parts = inner.split('|')
    const state = parts[0]

    let wpos = { x: 0, y: 0, z: 0 }
    let buf: { plannerBlocks: number; rxBytes: number } | undefined

    for (const part of parts.slice(1)) {
      if (part.startsWith('WPos:') || part.startsWith('MPos:')) {
        const coords = part.split(':')[1].split(',').map(Number)
        wpos = { x: coords[0] || 0, y: coords[1] || 0, z: coords[2] || 0 }
      }
      if (part.startsWith('Buf:')) {
        const vals = part.slice(4).split(',').map(Number)
        buf = { plannerBlocks: vals[0], rxBytes: vals[1] }
      }
    }

    this.emit('status', { state, wpos, buf })
  }

  // ── Private: Helpers ─────────────────────────────────────────

  private emitProgress(): void {
    if (!this.isStreaming) return
    this.emit('stream-progress', {
      currentLine: this.streamAckedCount,
      totalLines: this.streamTotal,
      percent: this.streamTotal > 0
        ? Math.round((this.streamAckedCount / this.streamTotal) * 100)
        : 0,
      elapsedS: (Date.now() - this.streamStartTime) / 1000,
    })
  }

  private resetStreamState(): void {
    this.isStreaming = false
    this.isPaused = false
    this.streamQueue = []
    this.streamSentIndex = 0
    this.streamAckedCount = 0
    this.sentLengths = []
    this.bufferUsage = 0
  }

  private startStatusPolling(): void {
    this.stopStatusPolling()
    this.statusInterval = setInterval(() => this.statusQuery(), 250)
  }

  private stopStatusPolling(): void {
    if (this.statusInterval) {
      clearInterval(this.statusInterval)
      this.statusInterval = null
    }
  }
}
