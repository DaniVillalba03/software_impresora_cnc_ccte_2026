import React, { useState } from 'react'
import {
  DEFAULT_HOOP_LAYER,
  DEFAULT_HELICAL_LAYER,
} from '@shared/types'
import type { LayerConfig, HoopLayerConfig, HelicalLayerConfig } from '@shared/types'
import {
  Layers,
  CircleDot,
  Orbit,
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  Sliders
} from 'lucide-react'

interface Props {
  layers: LayerConfig[]
  onLayersChange: (layers: LayerConfig[]) => void
}

export default function LayerManager({ layers, onLayersChange }: Props) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  const addLayer = (type: 'hoop' | 'helical') => {
    const newLayer = type === 'hoop'
      ? { ...DEFAULT_HOOP_LAYER }
      : { ...DEFAULT_HELICAL_LAYER }
    onLayersChange([...layers, newLayer])
    setExpandedIndex(layers.length)
  }

  const removeLayer = (index: number) => {
    onLayersChange(layers.filter((_, i) => i !== index))
    if (expandedIndex === index) setExpandedIndex(null)
  }

  const moveLayer = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= layers.length) return
    const next = [...layers]
    ;[next[index], next[target]] = [next[target], next[index]]
    onLayersChange(next)
    setExpandedIndex(target)
  }

  const updateLayer = (index: number, patch: Partial<LayerConfig>) => {
    const next = [...layers]
    next[index] = { ...next[index], ...patch } as LayerConfig
    onLayersChange(next)
  }

  return (
    <div className="bg-cnc-surface">
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-zinc-400" />
          <span className="panel-title text-zinc-300 font-semibold">Secuencia de Capas (Stack)</span>
        </div>
        <span className="text-[11px] text-zinc-400 font-mono bg-cnc-elevated px-2 py-0.5 rounded border border-cnc-border">
          {layers.length} {layers.length === 1 ? 'capa' : 'capas'}
        </span>
      </div>

      <div className="p-3 space-y-2">
        {/* ── Empty State ────────────────────────────────────── */}
        {layers.length === 0 && (
          <div className="text-center py-6 text-zinc-500 text-xs border border-dashed border-cnc-border rounded">
            No hay capas en el laminado. Agregue capas Hoop o Helical debajo.
          </div>
        )}

        {/* ── Layer Cards ────────────────────────────────────── */}
        {layers.map((layer, index) => (
          <div
            key={index}
            className={`${
              layer.windType === 'hoop' ? 'cad-layer-card-hoop' : 'cad-layer-card-helical'
            }`}
          >
            {/* Header row */}
            <div className="flex items-center gap-2">
              {layer.windType === 'hoop' ? (
                <CircleDot className="w-3.5 h-3.5 text-cnc-hoop flex-shrink-0" />
              ) : (
                <Orbit className="w-3.5 h-3.5 text-cnc-helical flex-shrink-0" />
              )}
              <button
                className="flex-1 text-left text-[12px] font-semibold text-zinc-200 hover:text-white cursor-pointer"
                onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
              >
                <span>Capa {index + 1}: </span>
                <span className="font-medium text-zinc-300">
                  {layer.windType === 'hoop' ? 'Circunferencial' : `Helicoidal (${layer.windAngle}°)`}
                </span>
                {layer.windType === 'hoop' && layer.terminal && (
                  <span className="text-amber-400 text-[10px] ml-1.5 font-mono uppercase">1-Vía</span>
                )}
              </button>

              {/* Action Buttons */}
              <div className="flex items-center gap-0.5">
                <button
                  className="btn-icon text-zinc-400 hover:text-zinc-200"
                  onClick={() => moveLayer(index, -1)}
                  disabled={index === 0}
                  title="Mover arriba"
                >
                  <ChevronUp className="w-3.5 h-3.5" />
                </button>
                <button
                  className="btn-icon text-zinc-400 hover:text-zinc-200"
                  onClick={() => moveLayer(index, 1)}
                  disabled={index === layers.length - 1}
                  title="Mover abajo"
                >
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
                <button
                  className="btn-icon text-zinc-400 hover:text-red-400"
                  onClick={() => removeLayer(index)}
                  title="Eliminar capa"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Quick summary chips when collapsed */}
            {expandedIndex !== index && layer.windType === 'helical' && (
              <div className="mt-1 flex items-center gap-2 text-[10px] font-mono text-zinc-400 pl-5">
                <span>Ángulo: {layer.windAngle}°</span>
                <span>·</span>
                <span>P:{layer.patternNumber}</span>
                <span>·</span>
                <span>Skip:{layer.skipIndex}</span>
                <span>·</span>
                <span>Lock:{layer.lockDegrees}°</span>
              </div>
            )}

            {/* Expanded Editor */}
            {expandedIndex === index && (
              <div className="mt-2.5 pt-2.5 border-t border-cnc-border/60">
                {layer.windType === 'hoop' ? (
                  <HoopEditor
                    layer={layer}
                    onChange={(patch) => updateLayer(index, patch)}
                  />
                ) : (
                  <HelicalEditor
                    layer={layer}
                    onChange={(patch) => updateLayer(index, patch)}
                  />
                )}
              </div>
            )}
          </div>
        ))}

        {/* ── Add Buttons ────────────────────────────────────── */}
        <div className="flex gap-2 pt-1">
          <button
            className="btn-secondary flex-1 flex items-center justify-center gap-1.5 py-1.5 text-zinc-300 hover:text-white"
            onClick={() => addLayer('hoop')}
          >
            <Plus className="w-3 h-3 text-cnc-hoop" />
            <span>+ Capa Hoop</span>
          </button>
          <button
            className="btn-secondary flex-1 flex items-center justify-center gap-1.5 py-1.5 text-zinc-300 hover:text-white"
            onClick={() => addLayer('helical')}
          >
            <Plus className="w-3 h-3 text-cnc-helical" />
            <span>+ Capa Helical</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Hoop Layer Editor ────────────────────────────────────────

function HoopEditor({
  layer,
  onChange,
}: {
  layer: HoopLayerConfig
  onChange: (patch: Partial<HoopLayerConfig>) => void
}) {
  return (
    <label className="flex items-center justify-between cursor-pointer py-1">
      <div className="flex flex-col">
        <span className="text-[11px] font-medium text-zinc-300">Modo Terminal (Solo ida)</span>
        <span className="text-[10px] text-zinc-500">Bobinado en un solo sentido sin recorrido de retorno</span>
      </div>
      <input
        type="checkbox"
        checked={layer.terminal}
        onChange={(e) => onChange({ terminal: e.target.checked })}
        className="w-4 h-4 rounded border-cnc-border bg-cnc-bg text-cnc-hoop accent-sky-500 cursor-pointer"
      />
    </label>
  )
}

// ── Helical Layer Editor ─────────────────────────────────────

function HelicalEditor({
  layer,
  onChange,
}: {
  layer: HelicalLayerConfig
  onChange: (patch: Partial<HelicalLayerConfig>) => void
}) {
  const field = (label: string, key: keyof HelicalLayerConfig, unit: string, step = 1, min = 0) => (
    <div>
      <label className="cad-label text-[10px]">{label}</label>
      <div className="cad-field-group">
        <input
          type="number"
          className="cad-field-input text-[11px]"
          value={layer[key] as number}
          step={step}
          min={min}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            if (!isNaN(v)) onChange({ [key]: v } as Partial<HelicalLayerConfig>)
          }}
        />
        <span className="cad-field-unit text-[10px]">{unit}</span>
      </div>
    </div>
  )

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-2">
        {field('Ángulo devanado', 'windAngle', '°', 1, 1)}
        {field('Pattern Number', 'patternNumber', '#', 1, 1)}
        {field('Skip Index', 'skipIndex', '#', 1, 0)}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {field('Lock extremos', 'lockDegrees', '°', 90, 0)}
        {field('Lead In', 'leadInMM', 'mm', 5, 0)}
        {field('Lead Out', 'leadOutDegrees', '°', 15, 0)}
      </div>
      <label className="flex items-center justify-between cursor-pointer pt-1 border-t border-cnc-border/40">
        <span className="text-[11px] text-zinc-400">Omitir lock inicial cercano</span>
        <input
          type="checkbox"
          checked={layer.skipInitialNearLock}
          onChange={(e) => onChange({ skipInitialNearLock: e.target.checked })}
          className="w-4 h-4 rounded border-cnc-border bg-cnc-bg text-cnc-helical accent-amber-500 cursor-pointer"
        />
      </label>
    </div>
  )
}
