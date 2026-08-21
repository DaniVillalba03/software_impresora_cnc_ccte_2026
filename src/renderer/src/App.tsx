import React, { useState, useCallback, useEffect } from 'react'
import {
  DEFAULT_WIND_CONFIG,
} from '@shared/types'
import type { WindConfig, LayerConfig, GCodeResult, GrblStatus, StreamProgress } from '@shared/types'
import { Play, Loader2, FileCode, Sliders, Cpu } from 'lucide-react'
import logoImg from './assets/logo.png'
import ConfigPanel from './components/ConfigPanel'
import LayerManager from './components/LayerManager'
import Viewport3D from './components/Viewport3D'
import GCodePanel from './components/GCodePanel'
import MachineControl from './components/MachineControl'

export default function App() {
  // ── Wind Configuration ─────────────────────────────────────
  const [config, setConfig] = useState<WindConfig>({ ...DEFAULT_WIND_CONFIG })

  // ── G-Code State ───────────────────────────────────────────
  const [gcodeResult, setGcodeResult] = useState<GCodeResult | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // ── Serial / GRBL State ────────────────────────────────────
  const [connected, setConnected] = useState(false)
  const [grblStatus, setGrblStatus] = useState<GrblStatus | null>(null)
  const [streamProgress, setStreamProgress] = useState<StreamProgress | null>(null)
  const [consoleLines, setConsoleLines] = useState<string[]>([])

  // ── Right Panel Tab ────────────────────────────────────────
  const [rightTab, setRightTab] = useState<'gcode' | 'machine'>('gcode')

  // ── Config Updates ─────────────────────────────────────────
  const updateConfig = useCallback((patch: Partial<WindConfig>) => {
    setConfig((prev) => ({ ...prev, ...patch }))
  }, [])

  const setLayers = useCallback((layers: LayerConfig[]) => {
    setConfig((prev) => ({ ...prev, layers }))
  }, [])

  // ── G-Code Generation ──────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)
    try {
      const result = await window.cycloneAPI.generateGCode(config)
      setGcodeResult(result)
      setRightTab('gcode')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setConsoleLines((prev) => [...prev, `[ERROR] ${msg}`])
    } finally {
      setIsGenerating(false)
    }
  }, [config])

  const handleExport = useCallback(async () => {
    if (!gcodeResult) return
    const path = await window.cycloneAPI.exportGCode(gcodeResult.gcode)
    if (path) {
      setConsoleLines((prev) => [...prev, `[INFO] G-Code exportado a: ${path}`])
    }
  }, [gcodeResult])

  // ── File Operations ────────────────────────────────────────
  const handleSave = useCallback(async () => {
    const path = await window.cycloneAPI.saveWindFile(config)
    if (path) {
      setConsoleLines((prev) => [...prev, `[INFO] Receta guardada en: ${path}`])
    }
  }, [config])

  const handleLoad = useCallback(async () => {
    const data = await window.cycloneAPI.loadWindFile()
    if (data && typeof data === 'object') {
      const loaded = data as WindConfig
      setConfig({
        layers: loaded.layers || [],
        mandrelParameters: loaded.mandrelParameters || DEFAULT_WIND_CONFIG.mandrelParameters,
        towParameters: loaded.towParameters || DEFAULT_WIND_CONFIG.towParameters,
        defaultFeedRate: loaded.defaultFeedRate || DEFAULT_WIND_CONFIG.defaultFeedRate,
        enableZAxis: loaded.enableZAxis ?? true,
      })
      setGcodeResult(null)
      setConsoleLines((prev) => [...prev, '[INFO] Receta cargada correctamente'])
    }
  }, [])

  // ── Serial Event Listeners ─────────────────────────────────
  useEffect(() => {
    const unsubs = [
      window.cycloneAPI.onSerialData((data) => {
        setConsoleLines((prev) => {
          const next = [...prev, data]
          return next.length > 500 ? next.slice(-400) : next
        })
      }),
      window.cycloneAPI.onGrblStatus((status) => {
        setGrblStatus(status)
      }),
      window.cycloneAPI.onStreamProgress((progress) => {
        setStreamProgress(progress)
      }),
      window.cycloneAPI.onConnectionStatus((status) => {
        setConnected(status.connected)
        setConsoleLines((prev) => [
          ...prev,
          status.connected
            ? `[INFO] Conectado a ${status.port} @ ${status.baudRate} baud`
            : '[INFO] Desconectado',
        ])
      }),
      window.cycloneAPI.onSerialError((error) => {
        setConsoleLines((prev) => [...prev, `[ERROR] ${error}`])
      }),
    ]
    return () => unsubs.forEach((unsub) => unsub())
  }, [])

  return (
    <div className="h-screen flex flex-col bg-cnc-bg text-cnc-text font-sans overflow-hidden">
      {/* ── Title Bar (Solid CAD Studio Header) ─────────────────── */}
      <header className="h-10 flex items-center px-3 bg-cnc-surface border-b border-cnc-border app-drag select-none flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <img src={logoImg} alt="CCTE CNC Logo" className="h-6 w-auto object-contain" />
          <span className="text-[13px] font-bold tracking-wider text-zinc-100 uppercase">
            CCTE CNC
          </span>
          <span className="text-[10px] text-zinc-400 font-mono px-1.5 py-0.5 rounded bg-cnc-elevated border border-cnc-border">
            v1.0
          </span>
        </div>
        <div className="flex-1" />

        {/* Global Machine Status Indicator */}
        <div className="app-no-drag flex items-center gap-3 text-[11px] text-zinc-400 font-mono">
          {connected && grblStatus ? (
            <div className="flex items-center gap-2 bg-cnc-elevated px-2.5 py-1 rounded border border-cnc-border">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm" />
              <span className="text-zinc-200 font-bold uppercase">{grblStatus.state}</span>
              <span className="text-zinc-600">|</span>
              <span>X: <strong className="text-zinc-200">{grblStatus.wpos.x.toFixed(1)}</strong></span>
              <span>Y: <strong className="text-zinc-200">{grblStatus.wpos.y.toFixed(1)}°</strong></span>
              <span>Z: <strong className="text-zinc-200">{grblStatus.wpos.z.toFixed(1)}°</strong></span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-cnc-elevated px-2 py-0.5 rounded border border-cnc-border">
              <span className="w-2 h-2 rounded-full bg-zinc-600" />
              <span className="text-zinc-500">CNC Desconectado</span>
            </div>
          )}
        </div>
      </header>

      {/* ── Main Workspace ───────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ─── Left Panel: Config & Layers ─────────────────────── */}
        <aside className="w-80 flex-shrink-0 border-r border-cnc-border flex flex-col overflow-hidden bg-cnc-surface">
          <div className="flex-1 overflow-y-auto">
            <ConfigPanel
              config={config}
              onUpdate={updateConfig}
              onSave={handleSave}
              onLoad={handleLoad}
            />
            <LayerManager
              layers={config.layers}
              onLayersChange={setLayers}
            />
          </div>

          {/* Primary Action Button (Solid Engineering Blue) */}
          <div className="p-2.5 border-t border-cnc-border bg-cnc-surface flex-shrink-0">
            <button
              className="btn-primary w-full py-2.5 flex items-center justify-center gap-2 text-[12px] font-semibold tracking-wide shadow-sm"
              onClick={handleGenerate}
              disabled={isGenerating || config.layers.length === 0}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Calculando Trayectorias...</span>
                </>
              ) : (
                <>
                  <Cpu className="w-4 h-4" />
                  <span>Generar G-Code</span>
                </>
              )}
            </button>
          </div>
        </aside>

        {/* ─── Center: 3D Viewport ─────────────────────────────── */}
        <main className="flex-1 relative bg-cnc-bg">
          <Viewport3D
            mandrel={config.mandrelParameters}
            tow={config.towParameters}
            gcode={gcodeResult?.gcode ?? null}
            layers={config.layers}
          />
        </main>

        {/* ─── Right Panel: G-Code & GRBL Control ───────────────── */}
        <aside className="w-[390px] flex-shrink-0 border-l border-cnc-border flex flex-col overflow-hidden bg-cnc-surface">
          {/* Tab switcher */}
          <div className="flex p-1.5 border-b border-cnc-border bg-cnc-surface gap-1">
            <button
              className={`flex-1 flex items-center justify-center gap-1.5 ${
                rightTab === 'gcode' ? 'tab-btn-active' : 'tab-btn-inactive'
              }`}
              onClick={() => setRightTab('gcode')}
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Visor G-Code</span>
            </button>
            <button
              className={`flex-1 flex items-center justify-center gap-1.5 ${
                rightTab === 'machine' ? 'tab-btn-active' : 'tab-btn-inactive'
              }`}
              onClick={() => setRightTab('machine')}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Control GRBL</span>
            </button>
          </div>

          <div className="flex-1 overflow-hidden">
            {rightTab === 'gcode' ? (
              <GCodePanel
                result={gcodeResult}
                onExport={handleExport}
              />
            ) : (
              <MachineControl
                connected={connected}
                grblStatus={grblStatus}
                streamProgress={streamProgress}
                consoleLines={consoleLines}
                gcode={gcodeResult?.gcode ?? null}
              />
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
