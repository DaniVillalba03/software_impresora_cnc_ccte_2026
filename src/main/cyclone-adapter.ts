// ═══════════════════════════════════════════════════════════════
// Cyclone Adapter — Bridges shared types with the Cyclone planner
// Captures planner console output for stats extraction
// ═══════════════════════════════════════════════════════════════

import { planWind } from '../planner'
import { ELayerType } from '../planner/types'
import type { IWindParameters, TLayerParameters } from '../planner/types'
import type { WindConfig, GCodeResult } from '../shared/types'

/**
 * Generate G-code from a wind configuration.
 * Wraps the Cyclone planner engine, captures console output for stats,
 * and optionally filters Z-axis commands for 2-axis machines.
 */
export function generateGCode(config: WindConfig): GCodeResult {
  // ── Convert shared types to Cyclone planner types ────────────
  const layers: TLayerParameters[] = config.layers.map((layer) => {
    if (layer.windType === 'hoop') {
      return {
        windType: ELayerType.HOOP,
        terminal: layer.terminal,
      }
    }
    return {
      windType: ELayerType.HELICAL,
      windAngle: layer.windAngle,
      patternNumber: layer.patternNumber,
      skipIndex: layer.skipIndex,
      lockDegrees: layer.lockDegrees,
      leadInMM: layer.leadInMM,
      leadOutDegrees: layer.leadOutDegrees,
      skipInitialNearLock: layer.skipInitialNearLock,
    }
  })

  const windParams: IWindParameters = {
    layers,
    mandrelParameters: config.mandrelParameters,
    towParameters: config.towParameters,
    defaultFeedRate: config.defaultFeedRate,
  }

  // ── Capture console output to extract time/tow stats ─────────
  const logs: string[] = []
  const origLog = console.log
  const origWarn = console.warn
  console.log = (...args: unknown[]) => logs.push(args.map(String).join(' '))
  console.warn = (...args: unknown[]) => logs.push('[WARN] ' + args.map(String).join(' '))

  let gcode: string[]
  try {
    gcode = planWind(windParams)
  } finally {
    // Always restore console
    console.log = origLog
    console.warn = origWarn
  }

  // ── Filter Z-axis commands if Z is disabled ──────────────────
  if (!config.enableZAxis) {
    gcode = gcode.map((line) => {
      if (line.startsWith('G0') || line.startsWith('G1') || line.startsWith('G92')) {
        // Remove Z coordinate from movement and position commands
        return line.replace(/\s*Z[\d.\-+]+/g, '')
      }
      return line
    })
  }

  // ── Parse statistics from captured console logs ──────────────
  let timeEstimateS = 0
  let towLengthM = 0

  for (const log of logs) {
    const timeMatch = log.match(/Total time estimate:\s*([\d.]+)\s*seconds/)
    if (timeMatch) timeEstimateS = parseFloat(timeMatch[1])

    const towMatch = log.match(/Total tow required:\s*([\d.]+)\s*meters/)
    if (towMatch) towLengthM = parseFloat(towMatch[1])
  }

  return { gcode, timeEstimateS, towLengthM, logs }
}
