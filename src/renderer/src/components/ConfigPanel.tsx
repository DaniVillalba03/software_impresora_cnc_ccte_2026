import React from 'react'
import type { WindConfig } from '@shared/types'
import { Cylinder, FolderOpen, Save, Settings2, SlidersHorizontal, Cpu } from 'lucide-react'

interface Props {
  config: WindConfig
  onUpdate: (patch: Partial<WindConfig>) => void
  onSave: () => void
  onLoad: () => void
}

export default function ConfigPanel({ config, onUpdate, onSave, onLoad }: Props) {
  const updateMandrel = (key: string, value: number) => {
    onUpdate({ mandrelParameters: { ...config.mandrelParameters, [key]: value } })
  }

  const updateTow = (key: string, value: number) => {
    onUpdate({ towParameters: { ...config.towParameters, [key]: value } })
  }

  return (
    <div className="border-b border-cnc-border bg-cnc-surface">
      {/* ── Panel Header ────────────────────────────────────── */}
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Settings2 className="w-3.5 h-3.5 text-zinc-400" />
          <span className="panel-title text-zinc-300 font-semibold">Parámetros Geométricos</span>
        </div>
        <div className="app-no-drag flex items-center gap-1">
          <button
            onClick={onLoad}
            className="btn-icon text-zinc-400 hover:text-white"
            title="Abrir receta (.wind)"
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onSave}
            className="btn-icon text-zinc-400 hover:text-white"
            title="Guardar receta (.wind)"
          >
            <Save className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* ── Mandril ─────────────────────────────────────────── */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1.5">
            <Cylinder className="w-3 h-3 text-zinc-500" />
            <span>Mandril Cilíndrico</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CadNumberInput
              label="Diámetro exterior"
              value={config.mandrelParameters.diameter}
              unit="mm"
              onChange={(v) => updateMandrel('diameter', v)}
              min={1}
              step={0.5}
            />
            <CadNumberInput
              label="Longitud útil"
              value={config.mandrelParameters.windLength}
              unit="mm"
              onChange={(v) => updateMandrel('windLength', v)}
              min={1}
              step={10}
            />
          </div>
        </div>

        {/* ── Filamento ───────────────────────────────────────── */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5 flex items-center gap-1.5">
            <SlidersHorizontal className="w-3 h-3 text-zinc-500" />
            <span>Filamento / Tow</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CadNumberInput
              label="Ancho de cinta"
              value={config.towParameters.width}
              unit="mm"
              onChange={(v) => updateTow('width', v)}
              min={0.1}
              step={0.5}
            />
            <CadNumberInput
              label="Espesor nominal"
              value={config.towParameters.thickness}
              unit="mm"
              onChange={(v) => updateTow('thickness', v)}
              min={0.01}
              step={0.05}
            />
          </div>
        </div>

        {/* ── Cinemática & Avance ─────────────────────────────── */}
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1.5">
            Cinemática & Avance
          </div>
          <CadNumberInput
            label="Velocidad de avance (Feed Rate)"
            value={config.defaultFeedRate}
            unit="mm/min"
            onChange={(v) => onUpdate({ defaultFeedRate: v })}
            min={100}
            step={500}
          />
        </div>

        {/* ── Tarjeta de Cinemática de Ejes (Estilo SolidWorks Box) ── */}
        <div className="border border-zinc-700/80 bg-zinc-800/40 rounded-md p-2.5 space-y-2 shadow-sm">
          <div className="flex items-center justify-between pb-1.5 border-b border-zinc-700/60">
            <div className="flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-200">
                CINEMÁTICA DE 3 EJES (CNC)
              </span>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-blue-950/60 text-blue-400 border border-blue-800/50 font-semibold">
              GRBL
            </span>
          </div>

          {/* Lista descriptiva de los 3 ejes */}
          <div className="space-y-1 text-[11px] font-mono">
            <div className="flex items-center justify-between bg-zinc-900/60 px-2 py-1 rounded border border-zinc-800/80">
              <span className="font-bold text-emerald-400">[X] Carro Transversal</span>
              <span className="text-[10px] text-zinc-400">Lineal · mm</span>
            </div>
            <div className="flex items-center justify-between bg-zinc-900/60 px-2 py-1 rounded border border-zinc-800/80">
              <span className="font-bold text-amber-400">[Y] Mandril / Torno</span>
              <span className="text-[10px] text-zinc-400">Rotacional · °</span>
            </div>
            <div className="flex items-center justify-between bg-zinc-900/60 px-2 py-1 rounded border border-zinc-800/80">
              <span className="font-bold text-purple-400">[Z] Cabezal Dosificador</span>
              <span className="text-[10px] text-zinc-400">Rotacional · °</span>
            </div>
          </div>

          {/* Toggle Switch estilizado para Eje Z */}
          <div className="pt-2 border-t border-zinc-700/60 flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] font-medium text-zinc-200">
                Habilitar Eje Z en G-Code
              </span>
              <span className="text-[9px] text-zinc-500 font-mono">
                {config.enableZAxis ? 'Generación activa (3 ejes)' : 'Omitido (2 ejes X/Y)'}
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={config.enableZAxis}
              onClick={() => onUpdate({ enableZAxis: !config.enableZAxis })}
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                config.enableZAxis ? 'bg-blue-600' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  config.enableZAxis ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Reusable CAD Number Input with Integrated Unit Badge ───────

function CadNumberInput({
  label,
  value,
  unit,
  onChange,
  min = 0,
  max,
  step = 1,
}: {
  label: string
  value: number
  unit: string
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <div>
      <label className="cad-label">{label}</label>
      <div className="cad-field-group">
        <input
          type="number"
          className="cad-field-input"
          value={value}
          min={min}
          max={max}
          step={step}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v) && v >= min && (max === undefined || v <= max)) {
              onChange(v)
            }
          }}
        />
        <span className="cad-field-unit">{unit}</span>
      </div>
    </div>
  )
}
