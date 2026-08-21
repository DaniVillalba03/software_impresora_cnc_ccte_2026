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
        this.emit('connection-status', { connected: false, port: portPath, baudRate })
      })

      this.port.open((error) => {
        if (error) {
          return reject(new Error(`Error opening port: ${error.message}`))
        }
        this._isConnected = true
        this.resetStreamState()
        this.emit('connection-status', { connected: true, port: portPath, baudRate })

        // Wait for GRBL to initialize, then send soft reset
        setTimeout(() => {
          this.softReset()
          this.startStatusPolling()
          resolve()
        }, 1500)
      })
    })
  }

  /** Disconnect from GRBL controller */
  async disconnect(): Promise<void> {
    this.stopStatusPolling()
    this.resetStreamState()

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

  /** Send jog command: $J=G91 X10 F1000 */
  jog(axis: string, distance: number, feedRate: number): void {
    if (!this.port?.isOpen) return
    const cmd = `$J=G91 ${axis}${distance} F${feedRate}`
    this.sendImmediate(cmd)
  }

  /** Cancel active jog */
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

  // ── Immediate Command ────────────────────────────────────────

  /** Send a single command immediately (not part of streaming) */
  sendImmediate(cmd: string): void {
    if (!this.port?.isOpen) return
    this.port.write(cmd + '\n')
  }

  // ── Streaming ────────────────────────────────────────────────

  /** Start streaming G-code with character-counting protocol */
  startStreaming(gcode: string[]): void {
    this.streamQueue = gcode.filter((line) => {
      const trimmed = line.trim()
      return trimmed.length > 0 && !trimmed.startsWith(';')
    })

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
