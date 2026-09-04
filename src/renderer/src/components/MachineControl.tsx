import React, { useState, useRef, useEffect, useCallback } from 'react'
import type { GrblStatus, StreamProgress } from '@shared/types'
import {
  RefreshCw,
  Cable,
  PowerOff,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  RotateCw,
  Undo2,
  Redo2,
  Home,
  Unlock,
  Play,
  Pause,
  AlertOctagon,
  Terminal,
  Crosshair,
  Trash2,
  Clock,
  Activity,
  Settings,
  Navigation
} from 'lucide-react'

interface Props {
  connected: boolean
  grblStatus: GrblStatus | null
  streamProgress: StreamProgress | null
  consoleLines: string[]
  gcode: string[] | null
}

export default function MachineControl({
  connected,
  grblStatus,
  streamProgress,
  consoleLines,
  gcode,
}: Props) {
  const [ports, setPorts] = useState<{ path: string; manufacturer?: string }[]>([])
  const [selectedPort, setSelectedPort] = useState('')
  const [baudRate, setBaudRate] = useState(115200)
  const [jogStepX, setJogStepX] = useState(10)
  const [jogAngleY, setJogAngleY] = useState(90)
  const [jogAngleZ, setJogAngleZ] = useState(45)
  const [jogFeedRate, setJogFeedRate] = useState(1500)
  const [manualCmd, setManualCmd] = useState('')
  const [activeConsole, setActiveConsole] = useState<string[]>(consoleLines)
  const consoleEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setActiveConsole(consoleLines)
  }, [consoleLines])

  // Auto-scroll console
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [activeConsole])

  const refreshPorts = useCallback(async () => {
    try {
      const list = await window.cycloneAPI.listPorts()
      setPorts(list)
      if (list.length > 0 && !selectedPort) {
        setSelectedPort(list[0].path)
      }
    } catch { /* ignore */ }
  }, [selectedPort])

  useEffect(() => { refreshPorts() }, [])

  const handleConnect = async () => {
    if (connected) {
      await window.cycloneAPI.disconnect()
    } else if (selectedPort) {
      try {
        await window.cycloneAPI.connect(selectedPort, baudRate)
      } catch (err: unknown) {
        console.error('Connection failed:', err)
      }
    }
  }

  const handleJog = (axis: string, distance: number) => {
    window.cycloneAPI.jog(axis, distance, jogFeedRate)
  }

  const handleZeroAxes = () => {
    window.cycloneAPI.zeroAxes()
  }

  const handleSendCommand = () => {
    if (manualCmd.trim()) {
      window.cycloneAPI.sendCommand(manualCmd.trim())
      setManualCmd('')
    }
  }

  const isStreaming = streamProgress && !streamProgress.complete && streamProgress.totalLines > 0
  const isIdle = grblStatus?.state === 'Idle'
  const stateStr = grblStatus?.state || (connected ? 'Conectado' : 'Desconectado')

  const getStatusBadge = () => {
    if (!connected) return <span className="badge-state bg-zinc-800 text-zinc-400 border-zinc-700">Offline</span>
    if (grblStatus?.state === 'Run') return <span className="badge-run">RUN</span>
    if (grblStatus?.state === 'Hold') return <span className="badge-hold">HOLD</span>
    if (grblStatus?.state === 'Alarm') return <span className="badge-alarm">ALARM</span>
    return <span className="badge-idle">IDLE</span>
  }

  // Calculate remaining time estimate
  const getRemainingTime = () => {
    if (!streamProgress || streamProgress.currentLine === 0 || !isStreaming) return null
    const rate = streamProgress.elapsedS / streamProgress.currentLine
    const remainingLines = streamProgress.totalLines - streamProgress.currentLine
    return formatTime(remainingLines * rate)
  }

  return (
    <div className="flex flex-col h-full bg-cnc-surface overflow-hidden">
      {/* ═══ Section 1: Connection Bar ════════════════════════ */}
      <div className="p-2.5 border-b border-cnc-border bg-cnc-bg/40 space-y-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-zinc-300">
            <Activity className="w-3.5 h-3.5 text-zinc-400" />
            <span>Hardware GRBL</span>
          </div>
          {getStatusBadge()}
        </div>

        <div className="flex items-center gap-1.5">
          <select
            className="cad-field-input bg-cnc-bg border border-cnc-border rounded py-1 text-[11px] flex-1 font-mono"
            value={selectedPort}
            onChange={(e) => setSelectedPort(e.target.value)}
            disabled={connected}
          >
            <option value="">Seleccionar puerto COM...</option>
            {ports.map((p) => (
              <option key={p.path} value={p.path}>
                {p.path} {p.manufacturer ? `(${p.manufacturer})` : ''}
              </option>
            ))}
          </select>

          <button
            className="btn-icon text-zinc-400 hover:text-white"
            onClick={refreshPorts}
            title="Buscar puertos COM"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <select
            className="cad-field-input bg-cnc-bg border border-cnc-border rounded py-1 text-[11px] w-24 font-mono text-center"
            value={baudRate}
            onChange={(e) => setBaudRate(Number(e.target.value))}
            disabled={connected}
          >
            {[115200, 57600, 38400, 19200, 9600].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <button
            className={connected ? 'btn-danger py-1 px-2.5 text-[11px]' : 'btn-success py-1 px-2.5 text-[11px]'}
            onClick={handleConnect}
          >
            {connected ? (
              <>
                <PowerOff className="w-3 h-3" />
                <span>Desconectar</span>
              </>
            ) : (
              <>
                <Cable className="w-3 h-3" />
                <span>Conectar</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* ═══ Section 2: DRO Digital Readout (X, Y, Z) ═════════ */}
      {connected && (
        <div className="px-3 py-2 border-b border-cnc-border bg-cnc-bg/80 grid grid-cols-3 gap-2 flex-shrink-0">
          <div className="bg-cnc-surface border border-cnc-border rounded px-2 py-1 flex flex-col">
            <span className="text-[9px] font-mono text-zinc-500 uppercase">Eje X (Carro)</span>
            <div className="flex items-baseline justify-between font-mono">
              <span className="text-sm font-bold text-emerald-400">
                {grblStatus?.wpos.x.toFixed(2) ?? '0.00'}
              </span>
              <span className="text-[10px] text-zinc-500">mm</span>
            </div>
          </div>

          <div className="bg-cnc-surface border border-cnc-border rounded px-2 py-1 flex flex-col">
            <span className="text-[9px] font-mono text-zinc-500 uppercase">Eje Y (Mandril)</span>
            <div className="flex items-baseline justify-between font-mono">
              <span className="text-sm font-bold text-amber-400">
                {grblStatus?.wpos.y.toFixed(1) ?? '0.0'}
              </span>
              <span className="text-[10px] text-zinc-500">°</span>
            </div>
          </div>

          <div className="bg-cnc-surface border border-cnc-border rounded px-2 py-1 flex flex-col">
            <span className="text-[9px] font-mono text-zinc-500 uppercase">Eje Z (Cabezal)</span>
            <div className="flex items-baseline justify-between font-mono">
              <span className="text-sm font-bold text-purple-400">
                {grblStatus?.wpos.z.toFixed(1) ?? '0.0'}
              </span>
              <span className="text-[10px] text-zinc-500">°</span>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Section 3: Jogging Control ═══════════════════════ */}
      {connected && (
        <div className="p-2.5 border-b border-cnc-border space-y-2 flex-shrink-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Control Manual (Jogging)
          </div>

          {/* Eje X: Carro lineal */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono text-zinc-400 w-10 font-bold">X (mm)</span>
            <button
              className="btn-secondary flex-1 py-1 text-[11px]"
              onClick={() => handleJog('X', -jogStepX)}
            >
              <ChevronLeft className="w-3 h-3" />
              <span>−{jogStepX}</span>
            </button>
            <div className="flex gap-0.5 bg-cnc-bg border border-cnc-border rounded p-0.5">
              {[0.1, 1, 10, 50, 100].map((v) => (
                <button
                  key={v}
                  onClick={() => setJogStepX(v)}
                  className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                    jogStepX === v ? 'bg-cnc-primary text-white font-bold' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
            <button
              className="btn-secondary flex-1 py-1 text-[11px]"
              onClick={() => handleJog('X', jogStepX)}
            >
              <span>+{jogStepX}</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Eje Y: Mandril */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono text-zinc-400 w-10 font-bold">Y (°)</span>
            <button
              className="btn-secondary flex-1 py-1 text-[11px]"
              onClick={() => handleJog('Y', -jogAngleY)}
            >
              <RotateCcw className="w-3 h-3" />
              <span>−{jogAngleY}°</span>
            </button>
            <div className="flex gap-0.5 bg-cnc-bg border border-cnc-border rounded p-0.5">
              {[1, 10, 45, 90, 360].map((v) => (
                <button
                  key={v}
                  onClick={() => setJogAngleY(v)}
                  className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                    jogAngleY === v ? 'bg-cnc-primary text-white font-bold' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {v}°
                </button>
              ))}
            </div>
            <button
              className="btn-secondary flex-1 py-1 text-[11px]"
              onClick={() => handleJog('Y', jogAngleY)}
            >
              <span>+{jogAngleY}°</span>
              <RotateCw className="w-3 h-3" />
            </button>
          </div>

          {/* Eje Z: Cabezal de entrega */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono text-zinc-400 w-10 font-bold">Z (°)</span>
            <button
              className="btn-secondary flex-1 py-1 text-[11px]"
              onClick={() => handleJog('Z', -jogAngleZ)}
            >
              <Undo2 className="w-3 h-3" />
              <span>−{jogAngleZ}°</span>
            </button>
            <div className="flex gap-0.5 bg-cnc-bg border border-cnc-border rounded p-0.5">
              {[1, 5, 10, 45, 90, 360].map((v) => (
                <button
                  key={v}
                  onClick={() => setJogAngleZ(v)}
                  className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                    jogAngleZ === v ? 'bg-cnc-primary text-white font-bold' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {v}°
                </button>
              ))}
            </div>
            <button
              className="btn-secondary flex-1 py-1 text-[11px]"
              onClick={() => handleJog('Z', jogAngleZ)}
            >
              <span>+{jogAngleZ}°</span>
              <Redo2 className="w-3 h-3" />
            </button>
          </div>

          {/* Reference & Origin Buttons */}
          <div className="flex items-center gap-1.5 pt-1">
            <button
              className="btn-secondary flex-1 py-1 text-[11px] text-zinc-300"
              onClick={handleZeroAxes}
              title="Fijar coordenadas actuales como X0 Y0 Z0 (G92)"
            >
              <Crosshair className="w-3 h-3 text-blue-400" />
              <span>Cero (G92)</span>
            </button>
            <button
              className="btn-secondary flex-1 py-1 text-[11px] text-zinc-300"
              onClick={() => window.cycloneAPI.goToOrigin()}
              title="Mover todos los ejes a la posición 0,0,0"
            >
              <Navigation className="w-3 h-3 text-emerald-400" />
              <span>Ir al Origen</span>
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              className="btn-secondary flex-1 py-1 text-[11px] text-zinc-300"
              onClick={() => window.cycloneAPI.home()}
              title="Ciclo de homing ($H)"
            >
              <Home className="w-3 h-3" />
              <span>Home ($H)</span>
            </button>
            <button
              className="btn-warning py-1 px-2.5 text-[11px]"
              onClick={() => window.cycloneAPI.unlock()}
              title="Desbloquear alarma ($X)"
            >
              <Unlock className="w-3 h-3" />
              <span>Unlock ($X)</span>
            </button>
          </div>

          {/* GRBL DRV8825 Configuration */}
          <div className="flex items-center gap-1.5">
            <button
              className="btn-secondary flex-1 py-1 text-[11px] text-zinc-300"
              onClick={() => {
                window.cycloneAPI.sendSettings([
                  '$0=10',    // Step pulse 10µs (DRV8825 safe)
                  '$1=25',    // Disable motors 25ms after idle
                  '$110=200.000', '$111=200.000', '$112=200.000', // Max rates
                  '$120=10.000', '$121=10.000', '$122=10.000',    // Accelerations
                ])
              }}
              title="Enviar configuración segura para drivers DRV8825 — limita velocidad y aceleración, desactiva motores en idle"
            >
              <Settings className="w-3 h-3 text-cyan-400" />
              <span>Config DRV8825</span>
            </button>
            <button
              className="btn-secondary flex-1 py-1 text-[11px] text-zinc-300"
              onClick={() => window.cycloneAPI.sendCommand('$$')}
              title="Mostrar configuración GRBL actual ($$)"
            >
              <Terminal className="w-3 h-3 text-zinc-400" />
              <span>Ver Config ($$)</span>
            </button>
          </div>

          {/* Motor Test — hardware diagnostic */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-500 whitespace-nowrap">Test Motor:</span>
            {['X', 'Y', 'Z'].map((axis) => (
              <button
                key={axis}
                className="btn-secondary flex-1 py-1 text-[11px] text-yellow-400 border-yellow-800/40"
                onClick={() => window.cycloneAPI.motorTest(axis)}
                title={`Test motor eje ${axis} — movimiento mínimo a velocidad muy baja para verificar hardware`}
              >
                <span>⚡ {axis}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Section 4: Execution & Streaming ═════════════════ */}
      {connected && (
        <div className="p-2.5 border-b border-cnc-border space-y-2 flex-shrink-0 bg-cnc-bg/30">
          <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            <span>Ejecución de Bobinado CNC</span>
            {isStreaming && (
              <span className="text-blue-400 font-mono flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Restante: {getRemainingTime() || '--'}</span>
              </span>
            )}
          </div>

          {/* Progress bar */}
          {isStreaming && streamProgress && (
            <div className="space-y-1">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${streamProgress.percent}%` }} />
              </div>
              <div className="flex justify-between text-[10px] font-mono text-zinc-400">
                <span>Línea {streamProgress.currentLine.toLocaleString()} / {streamProgress.totalLines.toLocaleString()}</span>
                <span className="font-bold text-zinc-200">{streamProgress.percent}%</span>
                <span>Transcurrido: {formatTime(streamProgress.elapsedS)}</span>
              </div>
            </div>
          )}

          {/* Control Buttons */}
          <div className="flex gap-1.5">
            {!isStreaming ? (
              <button
                className="btn-success flex-1 py-2 text-[12px] font-semibold tracking-wide shadow-sm"
                disabled={!gcode || !isIdle}
                onClick={() => gcode && window.cycloneAPI.startStreaming(gcode)}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Iniciar Bobinado</span>
              </button>
            ) : (
              <>
                {grblStatus?.state === 'Hold' ? (
                  <button
                    className="btn-warning flex-1 py-2 text-[12px] font-semibold"
                    onClick={() => window.cycloneAPI.resume()}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Reanudar</span>
                  </button>
                ) : (
                  <button
                    className="btn-warning flex-1 py-2 text-[12px] font-semibold"
                    onClick={() => window.cycloneAPI.pause()}
                  >
                    <Pause className="w-3.5 h-3.5 fill-current" />
                    <span>Pausar</span>
                  </button>
                )}
              </>
            )}

            <button
              className="btn-danger px-3 py-2 text-[12px] font-bold tracking-wider shadow-sm"
              onClick={() => window.cycloneAPI.abort()}
              title="PARADA DE EMERGENCIA — Envía Soft Reset (0x18) a GRBL"
            >
              <AlertOctagon className="w-4 h-4" />
              <span>E-STOP</span>
            </button>
          </div>
        </div>
      )}

      {/* ═══ Section 5: GRBL Real-Time Terminal Console ═══════ */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-3 py-1.5 border-b border-cnc-border bg-cnc-surface flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <Terminal className="w-3 h-3 text-zinc-400" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 font-mono">
              Consola Serial GRBL
            </span>
          </div>
          <button
            className="btn-icon text-zinc-500 hover:text-zinc-300"
            onClick={() => setActiveConsole([])}
            title="Limpiar consola"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-1 bg-[#0f1013] font-mono text-[11px] leading-relaxed select-text">
          {activeConsole.length === 0 ? (
            <div className="text-zinc-600 italic py-2 text-center text-[10px]">
              Consola lista. Conecte un puerto para ver la comunicación serial.
            </div>
          ) : (
            activeConsole.map((line, i) => (
              <div key={i} className={`console-line ${getConsoleClass(line)}`}>
                {line}
              </div>
            ))
          )}
          <div ref={consoleEndRef} />
        </div>

        {/* Command Input */}
        {connected && (
          <div className="flex items-center border-t border-cnc-border px-2 bg-cnc-bg/90 flex-shrink-0">
            <span className="text-xs text-blue-400 font-mono select-none mr-2 font-bold">{'>'}</span>
            <input
              type="text"
              className="flex-1 bg-transparent text-xs font-mono text-zinc-200 py-1.5 focus:outline-none placeholder-zinc-600"
              placeholder="Comando GRBL ($$, $H, $X, ?)..."
              value={manualCmd}
              onChange={(e) => setManualCmd(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendCommand()}
            />
          </div>
        )}
      </div>
    </div>
  )
}

function getConsoleClass(line: string): string {
  if (line === 'ok') return 'console-ok'
  if (line.startsWith('error:') || line.startsWith('ALARM:') || line.includes('[ERROR]'))
    return 'console-error'
  if (line.startsWith('[INFO]') || line.startsWith('Grbl'))
    return 'console-info'
  return 'text-zinc-300'
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  if (m < 60) return `${m}m ${s}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}
