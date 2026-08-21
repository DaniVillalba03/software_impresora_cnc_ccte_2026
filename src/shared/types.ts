// ═══════════════════════════════════════════════════════════════
// Shared types between Electron Main Process and Renderer
// ═══════════════════════════════════════════════════════════════

/** Mandrel / cylindrical mold parameters */
export interface MandrelParams {
  diameter: number    // mm
  windLength: number  // mm
}

/** Filament tow parameters */
export interface TowParams {
  width: number     // mm
  thickness: number // mm
}

/** Hoop winding layer configuration */
export interface HoopLayerConfig {
  windType: 'hoop'
  terminal: boolean
}

/** Helical winding layer configuration */
export interface HelicalLayerConfig {
  windType: 'helical'
  windAngle: number           // degrees
  patternNumber: number
  skipIndex: number
  lockDegrees: number         // degrees of mandrel rotation at ends
  leadInMM: number            // mm
  leadOutDegrees: number      // degrees
  skipInitialNearLock: boolean
}

/** Union type for all layer configurations */
export type LayerConfig = HoopLayerConfig | HelicalLayerConfig

/** Complete wind configuration — the main data object for the app */
export interface WindConfig {
  layers: LayerConfig[]
  mandrelParameters: MandrelParams
  towParameters: TowParams
  defaultFeedRate: number // mm/min
  enableZAxis: boolean    // Toggle 3rd axis (delivery head)
}

/** G-code generation result from the Cyclone engine */
export interface GCodeResult {
  gcode: string[]
  timeEstimateS: number
  towLengthM: number
  logs: string[]
}

/** Serial port information */
export interface PortInfo {
  path: string
  manufacturer?: string
  serialNumber?: string
  pnpId?: string
  vendorId?: string
  productId?: string
}

/** GRBL machine state */
export type GrblState =
  | 'Idle' | 'Run' | 'Hold' | 'Jog' | 'Alarm'
  | 'Door' | 'Check' | 'Home' | 'Sleep' | 'Disconnected'

/** GRBL status report data */
export interface GrblStatus {
  state: GrblState
  wpos: { x: number; y: number; z: number }
  buf?: { plannerBlocks: number; rxBytes: number }
}

/** Streaming progress */
export interface StreamProgress {
  currentLine: number
  totalLines: number
  percent: number
  elapsedS: number
  complete?: boolean
}

/** Serial connection state */
export interface ConnectionStatus {
  connected: boolean
  port: string
  baudRate: number
}

/** Default wind configuration */
export const DEFAULT_WIND_CONFIG: WindConfig = {
  layers: [],
  mandrelParameters: { diameter: 70, windLength: 500 },
  towParameters: { width: 7, thickness: 0.5 },
  defaultFeedRate: 9000,
  enableZAxis: true,
}

/** Default hoop layer */
export const DEFAULT_HOOP_LAYER: HoopLayerConfig = {
  windType: 'hoop',
  terminal: false,
}

/** Default helical layer */
export const DEFAULT_HELICAL_LAYER: HelicalLayerConfig = {
  windType: 'helical',
  windAngle: 55,
  patternNumber: 2,
  skipIndex: 1,
  lockDegrees: 720,
  leadInMM: 30,
  leadOutDegrees: 90,
  skipInitialNearLock: false,
}
