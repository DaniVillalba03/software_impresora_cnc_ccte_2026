import React, { useRef, useEffect, useMemo } from 'react'
import type { GCodeResult } from '@shared/types'
import { FileCode2, Download, Clock, Gauge, Route } from 'lucide-react'

interface Props {
  result: GCodeResult | null
  onExport: () => void
}

export default function GCodePanel({ result, onExport }: Props) {
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (result && listRef.current) {
      listRef.current.scrollTop = 0
    }
  }, [result])

  if (!result) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 h-full bg-cnc-surface">
        <div className="text-center text-zinc-500 text-xs space-y-3 flex flex-col items-center max-w-[220px]">
          <div className="w-12 h-12 rounded bg-cnc-elevated border border-cnc-border flex items-center justify-center">
            <FileCode2 className="w-6 h-6 text-zinc-400 stroke-[1.5]" />
          </div>
          <div>
            <div className="font-semibold text-zinc-300 mb-1">Sin G-Code Generado</div>
            <div className="text-[11px] leading-relaxed text-zinc-500">
              Configure las capas del laminado y presione <span className="text-blue-400 font-medium">"Generar G-Code"</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-cnc-surface">
      {/* Engineering Stats Cards */}
      <div className="p-2.5 border-b border-cnc-border bg-cnc-bg/60 grid grid-cols-3 gap-2 flex-shrink-0">
        <div className="bg-cnc-elevated border border-cnc-border rounded p-2 flex flex-col">
          <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-medium uppercase">
            <Route className="w-3 h-3 text-blue-400" />
            <span>Líneas</span>
          </div>
          <span className="text-sm font-bold text-zinc-200 font-mono mt-0.5">
            {result.gcode.length.toLocaleString()}
          </span>
        </div>

        <div className="bg-cnc-elevated border border-cnc-border rounded p-2 flex flex-col">
          <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-medium uppercase">
            <Clock className="w-3 h-3 text-amber-400" />
            <span>Tiempo Est.</span>
          </div>
          <span className="text-sm font-bold text-zinc-200 font-mono mt-0.5">
            {formatTime(result.timeEstimateS)}
          </span>
        </div>

        <div className="bg-cnc-elevated border border-cnc-border rounded p-2 flex flex-col">
          <div className="flex items-center gap-1 text-[10px] text-zinc-500 font-medium uppercase">
            <Gauge className="w-3 h-3 text-emerald-400" />
            <span>Tow Total</span>
          </div>
          <span className="text-sm font-bold text-zinc-200 font-mono mt-0.5">
            {result.towLengthM.toFixed(1)} m
          </span>
        </div>
      </div>

      {/* Export Action Bar */}
      <div className="px-3 py-1.5 border-b border-cnc-border bg-cnc-surface flex items-center justify-between flex-shrink-0">
        <span className="text-[11px] font-mono text-zinc-400">
          Programa CNC (3 Ejes GRBL)
        </span>
        <button
          onClick={onExport}
          className="btn-primary btn-sm flex items-center gap-1.5 py-1 px-2.5 shadow-sm"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Exportar .gcode</span>
        </button>
      </div>

      {/* G-Code Monospace High-Density Viewer */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto bg-[#101114] p-1 font-mono text-[11px] leading-5 select-text"
      >
        {result.gcode.map((line, i) => (
          <GCodeLine key={i} lineNum={i + 1} content={line} />
        ))}
      </div>
    </div>
  )
}

function GCodeLine({ lineNum, content }: { lineNum: number; content: string }) {
  const highlighted = useMemo(() => highlightGCode(content), [content])

  return (
    <div className="flex hover:bg-zinc-800/40 transition-colors py-px group">
      <span className="w-11 flex-shrink-0 text-right pr-2 text-zinc-600 select-none border-r border-zinc-800/80 font-mono text-[10px]">
        {lineNum}
      </span>
      <span className="pl-2.5 whitespace-pre font-mono" dangerouslySetInnerHTML={{ __html: highlighted }} />
    </div>
  )
}

function highlightGCode(line: string): string {
  const trimmed = line.trim()

  if (trimmed.startsWith(';')) {
    return `<span class="gcode-comment">${escapeHtml(line)}</span>`
  }

  return escapeHtml(line)
    .replace(
      /\b(G0|G1|G92|G28|G90|G91|M0|M2|M3|M5|\$[A-Z=][\w=]*)/g,
      '<span class="gcode-command">$1</span>'
    )
    .replace(/X([\d.\-+]+)/g, '<span class="text-zinc-500">X</span><span class="gcode-x font-semibold">$1</span>')
    .replace(/Y([\d.\-+]+)/g, '<span class="text-zinc-500">Y</span><span class="gcode-y font-semibold">$1</span>')
    .replace(/Z([\d.\-+]+)/g, '<span class="text-zinc-500">Z</span><span class="gcode-z font-semibold">$1</span>')
    .replace(/F([\d.\-+]+)/g, '<span class="text-zinc-500">F</span><span class="gcode-f font-semibold">$1</span>')
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function formatTime(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  if (m < 60) return `${m}m ${s}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}
