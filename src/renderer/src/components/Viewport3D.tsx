import React, { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, GizmoHelper, GizmoViewcube, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import type { MandrelParams, TowParams, LayerConfig, GrblStatus, StreamProgress } from '@shared/types'
import { Box, RotateCcw } from 'lucide-react'

interface Props {
  mandrel: MandrelParams
  tow: TowParams
  gcode: string[] | null
  layers: LayerConfig[]
  grblStatus: GrblStatus | null
  streamProgress: StreamProgress | null
}

// ═══════════════════════════════════════════════════════════════
// Viewport3D — High-Performance CAD/CAM 3D Viewport
// Demand-rendering GPU optimization, Autodesk/SolidWorks ViewCube,
// Batched buffer geometries per layer for maximum throughput.
// Real-time simulation: tool head, mandrel rotation, progressive trace.
// ═══════════════════════════════════════════════════════════════

export default function Viewport3D({ mandrel, tow, gcode, layers, grblStatus, streamProgress }: Props) {
  const controlsRef = useRef<any>(null)
  const [viewMode, setViewMode] = useState<'iso' | 'front' | 'top' | 'side'>('iso')

  // Determine if we're actively streaming (need continuous rendering)
  const isStreaming = !!(streamProgress && !streamProgress.complete && streamProgress.totalLines > 0)

  const setCameraView = (type: 'iso' | 'front' | 'top' | 'side') => {
    setViewMode(type)
    if (!controlsRef.current) return

    const dist = Math.max(mandrel.windLength * 0.95, mandrel.diameter * 4.5, 320)

    if (type === 'iso') {
      controlsRef.current.object.position.set(dist * 0.65, dist * 0.55, dist * 0.8)
    } else if (type === 'front') {
      controlsRef.current.object.position.set(0, 0, dist)
    } else if (type === 'top') {
      controlsRef.current.object.position.set(0, dist, 0.001)
    } else if (type === 'side') {
      controlsRef.current.object.position.set(dist, 0, 0)
    }
    controlsRef.current.target.set(0, 0, 0)
    controlsRef.current.update()
  }

  const resetView = () => {
    setCameraView('iso')
  }

  return (
    <div className="absolute inset-0 overflow-hidden select-none bg-gradient-to-b from-[#1b1e25] to-[#0f1115]">
      {/* ── Dynamic Frameloop Canvas ───────────────────────── */}
      <Canvas
        frameloop={isStreaming ? 'always' : 'demand'}
        dpr={[1, 1.5]}
        performance={{ min: 0.5 }}
        camera={{ position: [260, 190, 360], fov: 40, near: 1, far: 15000 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
        }}
      >
        <SceneContent
          mandrel={mandrel}
          tow={tow}
          gcode={gcode}
          layers={layers}
          grblStatus={grblStatus}
          streamProgress={streamProgress}
          controlsRef={controlsRef}
        />
      </Canvas>

      {/* ── CAD Preset Camera Toolbar (Top Left) ─────────────── */}
      <div className="absolute top-3 left-3 flex items-center bg-zinc-900/90 backdrop-blur border border-zinc-700/80 rounded p-1 shadow-lg gap-1">
        <button
          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
            viewMode === 'iso' ? 'bg-blue-600 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
          onClick={() => setCameraView('iso')}
          title="Vista Isométrica 3D"
        >
          <Box className="w-3 h-3" />
          <span>Iso</span>
        </button>
        <button
          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
            viewMode === 'front' ? 'bg-blue-600 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
          onClick={() => setCameraView('front')}
          title="Vista Frontal (Carro X)"
        >
          <span>Frontal</span>
        </button>
        <button
          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
            viewMode === 'top' ? 'bg-blue-600 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
          onClick={() => setCameraView('top')}
          title="Vista Superior (Planta)"
        >
          <span>Planta</span>
        </button>
        <button
          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
            viewMode === 'side' ? 'bg-blue-600 text-white font-bold' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
          }`}
          onClick={() => setCameraView('side')}
          title="Vista Lateral (Mandril Y)"
        >
          <span>Lateral</span>
        </button>
        <div className="w-px h-4 bg-zinc-700 mx-0.5" />
        <button
          className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          onClick={resetView}
          title="Centrar y reajustar cámara"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Engineering Status Overlay (Bottom Left) ─────────── */}
      <div className="absolute bottom-3 left-3 bg-zinc-900/90 backdrop-blur border border-zinc-700/80 px-3 py-1.5 rounded text-[11px] font-mono text-zinc-400 flex items-center gap-3 shadow-md">
        <div>
          <span className="text-zinc-500 font-sans">MANDRIL:</span>{' '}
          <span className="text-zinc-200 font-semibold">⌀{mandrel.diameter}</span> ×{' '}
          <span className="text-zinc-200 font-semibold">{mandrel.windLength} mm</span>
        </div>
        <div className="w-px h-3 bg-zinc-700" />
        <div>
          <span className="text-zinc-500 font-sans">TOW:</span>{' '}
          <span className="text-zinc-200 font-semibold">{tow.width} mm</span>
        </div>
        {gcode && (
          <>
            <div className="w-px h-3 bg-zinc-700" />
            <div>
              <span className="text-zinc-500 font-sans">G-CODE:</span>{' '}
              <span className="text-emerald-400 font-semibold">{gcode.length.toLocaleString()} líneas</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// Scene Content — Everything inside the R3F Canvas
// ═══════════════════════════════════════════════════════════════

function SceneContent({
  mandrel,
  tow,
  gcode,
  layers,
  grblStatus,
  streamProgress,
  controlsRef,
}: Props & { controlsRef: React.MutableRefObject<any> }) {
  const radius = mandrel.diameter / 2
  const length = mandrel.windLength

  // Determine if we're actively streaming
  const isStreaming = !!(streamProgress && !streamProgress.complete && streamProgress.totalLines > 0)

  // Compute optimized batched layer geometries for ultra-low GPU draw calls
  // Also returns the G-code line → vertex index mapping for progressive trace
  const { layerGeometries, gcodeLineToVertexEnd, totalVertexPairs } = useMemo(() => {
    if (!gcode || gcode.length === 0) return { layerGeometries: [] as BatchedLayer[], gcodeLineToVertexEnd: [] as number[], totalVertexPairs: 0 }
    return parseGCodeToLayerGeometries(gcode, radius, length, layers)
  }, [gcode, radius, length, layers])

  // Mandrel rotation angle from GRBL Y axis (degrees)
  const mandrelRotationDeg = grblStatus?.wpos.y ?? 0

  return (
    <>
      {/* Studio 3-Point Lighting */}
      <ambientLight intensity={0.55} />
      <directionalLight position={[400, 500, 300]} intensity={1.1} />
      <directionalLight position={[-400, -200, -300]} intensity={0.4} color="#94a3b8" />
      <pointLight position={[0, radius + 160, 0]} intensity={0.65} color="#e2e8f0" />

      {/* Solid Machined PBR Mandrel Assembly with Synchronized Rotation */}
      <SolidMandrelAssembly radius={radius} length={length} rotationDeg={mandrelRotationDeg} />

      {/* Progressive Filament Winding Trace */}
      <ProgressiveWindingTrace
        layerGeometries={layerGeometries}
        gcodeLineToVertexEnd={gcodeLineToVertexEnd}
        totalVertexPairs={totalVertexPairs}
        streamProgress={streamProgress}
        isStreaming={isStreaming}
      />

      {/* Tool Head Indicator — Virtual Delivery Head */}
      {grblStatus && (
        <ToolHeadIndicator
          wpos={grblStatus.wpos}
          radius={radius}
          length={length}
          isStreaming={isStreaming}
        />
      )}

      {/* Ground Contact Shadow (Static 1-frame bake for 0% GPU overhead) */}
      <ContactShadows
        frames={1}
        resolution={512}
        position={[0, -radius - 28, 0]}
        opacity={0.45}
        scale={Math.max(length * 1.5, 600)}
        blur={2}
        far={160}
      />

      {/* Technical CAD Floor Grid */}
      <Grid
        args={[3200, 3200]}
        position={[0, -radius - 28, 0]}
        cellSize={25}
        cellColor="#262a35"
        cellThickness={0.8}
        sectionSize={100}
        sectionColor="#3b4152"
        sectionThickness={1.3}
        fadeDistance={2000}
        fadeStrength={1.5}
        infiniteGrid
      />

      {/* Orbit Controls */}
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={20}
        maxDistance={5000}
      />

      {/* ── Autodesk / SolidWorks 3D ViewCube (Top Right) ────── */}
      <GizmoHelper alignment="top-right" margin={[72, 72]}>
        <GizmoViewcube
          faces={['FRONT', 'RIGHT', 'BACK', 'LEFT', 'TOP', 'BOTTOM']}
          color="#252830"
          textColor="#f1f5f9"
          strokeColor="#454b59"
          hoverColor="#2563eb"
          opacity={0.92}
        />
      </GizmoHelper>
    </>
  )
}

// ═══════════════════════════════════════════════════════════════
// Tool Head Indicator — Virtual Delivery Head on the Mandrel
// Moves along X axis, rotates with Z axis (delivery head angle)
// ═══════════════════════════════════════════════════════════════

function ToolHeadIndicator({
  wpos,
  radius,
  length,
  isStreaming,
}: {
  wpos: { x: number; y: number; z: number }
  radius: number
  length: number
  isStreaming: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  const glowRef = useRef<THREE.Mesh>(null)

  // Smooth interpolation targets
  const smoothPos = useRef({ x: 0, z: 0 })

  useFrame((_state, delta) => {
    if (!groupRef.current) return

    // Target position: X along mandrel axis, Z is delivery head rotation in degrees
    const targetX = wpos.x - length / 2
    const targetZRad = (wpos.z * Math.PI) / 180

    // Lerp for smooth motion (faster convergence = 8 * delta, capped at 1)
    const lerpFactor = Math.min(1, 8 * delta)
    smoothPos.current.x += (targetX - smoothPos.current.x) * lerpFactor
    smoothPos.current.z += (targetZRad - smoothPos.current.z) * lerpFactor

    // Position the tool head on the mandrel surface
    const toolRadius = radius + 12
    groupRef.current.position.set(
      smoothPos.current.x,
      toolRadius * Math.cos(smoothPos.current.z),
      toolRadius * Math.sin(smoothPos.current.z)
    )

    // Orient the tool head to always point toward the mandrel center
    groupRef.current.lookAt(smoothPos.current.x, 0, 0)

    // Pulse glow effect during streaming
    if (glowRef.current && isStreaming) {
      const pulse = 0.6 + 0.4 * Math.sin(_state.clock.elapsedTime * 4)
      ;(glowRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse
    }
  })

  return (
    <group ref={groupRef}>
      {/* Main Torus Ring — Delivery Nozzle */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[6, 1.5, 12, 32]} />
        <meshStandardMaterial
          color="#ff6b35"
          emissive="#ff4500"
          emissiveIntensity={0.5}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Pointer Cone — Direction indicator toward mandrel */}
      <mesh position={[0, 0, 4]} rotation={[Math.PI / 2, 0, 0]}>
        <coneGeometry args={[3, 8, 16]} />
        <meshStandardMaterial
          color="#ff6b35"
          emissive="#ff4500"
          emissiveIntensity={0.4}
          metalness={0.6}
          roughness={0.35}
        />
      </mesh>

      {/* Glow Sphere — Pulsing activity indicator during streaming */}
      <mesh ref={glowRef}>
        <sphereGeometry args={[2.5, 16, 16]} />
        <meshStandardMaterial
          color="#ff8c00"
          emissive="#ff4500"
          emissiveIntensity={0.5}
          transparent
          opacity={0.85}
        />
      </mesh>
    </group>
  )
}

// ═══════════════════════════════════════════════════════════════
// Solid PBR Mandrel & Lathe Spindle Assembly with Rotation
// ═══════════════════════════════════════════════════════════════

function SolidMandrelAssembly({
  radius,
  length,
  rotationDeg,
}: {
  radius: number
  length: number
  rotationDeg: number
}) {
  const groupRef = useRef<THREE.Group>(null)
  const smoothRotation = useRef(0)

  const spindleRadius = Math.max(8, radius * 0.3)
  const spindleLength = 60

  // Smoothly interpolate mandrel rotation each frame
  useFrame((_state, delta) => {
    if (!groupRef.current) return

    const targetRad = (rotationDeg * Math.PI) / 180
    const lerpFactor = Math.min(1, 8 * delta)
    smoothRotation.current += (targetRad - smoothRotation.current) * lerpFactor

    // Rotate around X axis (the mandrel's longitudinal axis in world space)
    // The cylinder is rotated [0, 0, PI/2] so its axis is along world X.
    // We rotate the entire group around the X axis.
    groupRef.current.rotation.x = smoothRotation.current
  })

  return (
    <group ref={groupRef}>
      {/* Main Solid Cylinder (Machined Aluminum / Steel) */}
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0, 0]}>
        <cylinderGeometry args={[radius, radius, length, 64, 1, false]} />
        <meshStandardMaterial
          color="#76808e"
          metalness={0.8}
          roughness={0.34}
          envMapIntensity={1.2}
        />
      </mesh>

      {/* Left Machined End Cap */}
      <mesh position={[-length / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[radius * 0.98, radius, 2, 64]} />
        <meshStandardMaterial color="#5e6674" metalness={0.85} roughness={0.28} />
      </mesh>

      {/* Right Machined End Cap */}
      <mesh position={[length / 2, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[radius * 0.98, radius, 2, 64]} />
        <meshStandardMaterial color="#5e6674" metalness={0.85} roughness={0.28} />
      </mesh>

      {/* Left Lathe Chuck Mounting Spindle */}
      <mesh position={[-length / 2 - spindleLength / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[spindleRadius, spindleRadius, spindleLength, 32]} />
        <meshStandardMaterial color="#353942" metalness={0.92} roughness={0.22} />
      </mesh>

      {/* Right Lathe Chuck Mounting Spindle */}
      <mesh position={[length / 2 + spindleLength / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[spindleRadius, spindleRadius, spindleLength, 32]} />
        <meshStandardMaterial color="#353942" metalness={0.92} roughness={0.22} />
      </mesh>
    </group>
  )
}

// ═══════════════════════════════════════════════════════════════
// Progressive Winding Trace — Real-time filament visualization
// Uses drawRange for O(1) progress updates without re-creating geometry
// ═══════════════════════════════════════════════════════════════

function ProgressiveWindingTrace({
  layerGeometries,
  gcodeLineToVertexEnd,
  totalVertexPairs,
  streamProgress,
  isStreaming,
}: {
  layerGeometries: BatchedLayer[]
  gcodeLineToVertexEnd: number[]
  totalVertexPairs: number
  streamProgress: StreamProgress | null
  isStreaming: boolean
}) {
  const executedRefs = useRef<THREE.LineSegments[]>([])
  const pendingRefs = useRef<THREE.LineSegments[]>([])

  // Track which vertex pair index the current stream line corresponds to
  useFrame(() => {
    if (!isStreaming || layerGeometries.length === 0) {
      // Not streaming: show all lines as fully executed (solid colors)
      for (const line of executedRefs.current) {
        if (line?.geometry) {
          const totalVerts = line.geometry.getAttribute('position')?.count ?? 0
          line.geometry.setDrawRange(0, totalVerts)
        }
      }
      // Hide pending preview when not streaming
      for (const line of pendingRefs.current) {
        if (line) line.visible = false
      }
      return
    }

    // During streaming: compute how many vertex pairs have been executed
    const currentLine = streamProgress?.currentLine ?? 0

    // Look up total vertex pairs executed up to this G-code line
    // gcodeLineToVertexEnd maps G-code line index → cumulative vertex pair count
    let executedPairs = 0
    if (currentLine > 0 && gcodeLineToVertexEnd.length > 0) {
      const clampedLine = Math.min(currentLine, gcodeLineToVertexEnd.length) - 1
      executedPairs = gcodeLineToVertexEnd[clampedLine] ?? 0
    }

    // Distribute the executed vertex count across layers
    // Each layer's geometry has its own vertex set. We need to figure out
    // how many vertices to show per layer based on execution progress.
    let remainingPairs = executedPairs

    for (let i = 0; i < layerGeometries.length; i++) {
      const executed = executedRefs.current[i]
      const pending = pendingRefs.current[i]
      if (!executed?.geometry) continue

      const totalVerts = executed.geometry.getAttribute('position')?.count ?? 0
      const layerPairs = totalVerts / 2

      if (remainingPairs >= layerPairs) {
        // This entire layer is executed
        executed.geometry.setDrawRange(0, totalVerts)
        remainingPairs -= layerPairs
        if (pending) pending.visible = false
      } else {
        // Partially executed layer
        executed.geometry.setDrawRange(0, remainingPairs * 2)
        remainingPairs = 0
        if (pending) pending.visible = true
      }
    }
  })

  if (layerGeometries.length === 0) return null

  return (
    <group>
      {layerGeometries.map((layerGeo, i) => (
        <group key={i}>
          {/* Executed portion — solid bright color */}
          <primitive
            object={layerGeo.executedLineSegments}
            ref={(el: THREE.LineSegments | null) => {
              if (el) executedRefs.current[i] = el
            }}
          />
          {/* Pending portion — semitransparent preview */}
          <primitive
            object={layerGeo.pendingLineSegments}
            ref={(el: THREE.LineSegments | null) => {
              if (el) pendingRefs.current[i] = el
            }}
          />
        </group>
      ))}
    </group>
  )
}

// ═══════════════════════════════════════════════════════════════
// Batched G-Code Trajectory Parser (Ultra Low GPU Draw Calls)
// Now returns G-code line → vertex mapping for progressive trace
// ═══════════════════════════════════════════════════════════════

interface BatchedLayer {
  executedLineSegments: THREE.LineSegments
  pendingLineSegments: THREE.LineSegments
}

const CAD_LAYER_PALETTE = [
  '#38bdf8', // Hoop Layer (Capas circunferenciales) — Steel Blue
  '#f59e0b', // Helical Layer 1 (Capas helicoidales) — Technical Amber
  '#10b981', // Helical Layer 2 — Technical Emerald
  '#a855f7', // Helical Layer 3 — Purple
  '#06b6d4', // Helical Layer 4 — Cyan
  '#f97316', // Helical Layer 5 — Coral Orange
]

function parseGCodeToLayerGeometries(
  gcode: string[],
  radius: number,
  length: number,
  layers: LayerConfig[]
): { layerGeometries: BatchedLayer[]; gcodeLineToVertexEnd: number[]; totalVertexPairs: number } {
  // Store line segment pairs per layer: layerIndex -> array of vertex coordinates [x0,y0,z0, x1,y1,z1, ...]
  const layerVertices: Map<number, number[]> = new Map()

  // Map each G-code line index to the cumulative vertex pair count at that point
  // (only for G0/G1 lines that produce geometry)
  const gcodeLineToVertexEnd: number[] = []
  let cumulativeVertexPairs = 0

  let currentLayerIndex = 0
  let x = 0
  let y = 0

  const getSurfacePoint = (
    xMM: number,
    yDeg: number,
    layerIdx: number
  ): [number, number, number] => {
    // Subtle layer stacking (+0.35mm base, +0.15mm per layer) so helical crossed patterns pop cleanly
    const r = radius + 0.35 + layerIdx * 0.15
    const theta = (yDeg * Math.PI) / 180
    const px = xMM - length / 2
    const py = r * Math.cos(theta)
    const pz = r * Math.sin(theta)
    return [px, py, pz]
  }

  for (let lineIdx = 0; lineIdx < gcode.length; lineIdx++) {
    const line = gcode[lineIdx]
    const trimmed = line.trim()

    // Detect layer transitions from comments like "; Layer 1 of 3: Hoop" or "; Layer 2 of 3: Helical"
    if (trimmed.startsWith(';')) {
      const layerMatch = trimmed.match(/Layer\s+(\d+)\s+of\s+\d+/)
      if (layerMatch) {
        currentLayerIndex = parseInt(layerMatch[1], 10) - 1
      }
      // Non-movement line: record same cumulative count
      gcodeLineToVertexEnd.push(cumulativeVertexPairs)
      continue
    }

    if (!trimmed.startsWith('G0') && !trimmed.startsWith('G1')) {
      // Non-movement line
      gcodeLineToVertexEnd.push(cumulativeVertexPairs)
      continue
    }

    const parts = trimmed.split(' ')
    let newX = x
    let newY = y

    for (const part of parts.slice(1)) {
      if (part.startsWith('X')) newX = parseFloat(part.slice(1))
      if (part.startsWith('Y')) newY = parseFloat(part.slice(1))
    }

    if (newX !== x || newY !== y) {
      if (!layerVertices.has(currentLayerIndex)) {
        layerVertices.set(currentLayerIndex, [])
      }
      const coords = layerVertices.get(currentLayerIndex)!

      const deltaX = newX - x
      const deltaY = newY - y
      // Subdivide arcs into fine steps (<= 4° of rotation or <= 5mm) to hug the cylindrical mandrel
      const steps = Math.max(1, Math.ceil(Math.abs(deltaY) / 4), Math.ceil(Math.abs(deltaX) / 5))

      let prevPoint = getSurfacePoint(x, y, currentLayerIndex)

      for (let s = 1; s <= steps; s++) {
        const t = s / steps
        const ix = x + deltaX * t
        const iy = y + deltaY * t
        const curPoint = getSurfacePoint(ix, iy, currentLayerIndex)

        // Line segment: prevPoint -> curPoint
        coords.push(prevPoint[0], prevPoint[1], prevPoint[2])
        coords.push(curPoint[0], curPoint[1], curPoint[2])

        cumulativeVertexPairs++
        prevPoint = curPoint
      }

      x = newX
      y = newY
    }

    // Record cumulative vertex pairs after processing this G-code line
    gcodeLineToVertexEnd.push(cumulativeVertexPairs)
  }

  // Build a single LineSegments object per layer for 1 draw call per layer
  // Each layer gets two LineSegments: executed (solid) and pending (semitransparent)
  const batchedLayers: BatchedLayer[] = []

  layerVertices.forEach((vertices, layerIdx) => {
    if (vertices.length === 0) return

    const isHoop =
      layerIdx < layers.length
        ? layers[layerIdx].windType === 'hoop'
        : layerIdx === 0

    const colorHex = isHoop
      ? CAD_LAYER_PALETTE[0]
      : CAD_LAYER_PALETTE[1 + (layerIdx % (CAD_LAYER_PALETTE.length - 1))]

    // Executed geometry — solid bright color
    const execGeometry = new THREE.BufferGeometry()
    execGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(new Float32Array(vertices), 3)
    )

    const execMaterial = new THREE.LineBasicMaterial({
      color: colorHex,
      linewidth: 2,
    })

    const executedLineSegments = new THREE.LineSegments(execGeometry, execMaterial)

    // Pending geometry — semitransparent preview (same geometry, different material)
    const pendingGeometry = new THREE.BufferGeometry()
    pendingGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(new Float32Array(vertices), 3)
    )

    const pendingMaterial = new THREE.LineBasicMaterial({
      color: colorHex,
      linewidth: 1,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
    })

    const pendingLineSegments = new THREE.LineSegments(pendingGeometry, pendingMaterial)
    pendingLineSegments.visible = false // Hidden by default (shown during streaming)

    batchedLayers.push({ executedLineSegments, pendingLineSegments })
  })

  return { layerGeometries: batchedLayers, gcodeLineToVertexEnd, totalVertexPairs: cumulativeVertexPairs }
}
