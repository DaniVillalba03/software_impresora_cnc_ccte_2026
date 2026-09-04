export {}

declare module '*.png' {
  const content: string
  export default content
}

declare module '*.svg' {
  const content: string
  export default content
}

declare module '*.jpg' {
  const content: string
  export default content
}

declare module '*.jpeg' {
  const content: string
  export default content
}

declare module '*.webp' {
  const content: string
  export default content
}

declare global {
  interface Window {
    cycloneAPI: {
      // Cyclone Engine
      generateGCode: (params: unknown) => Promise<import('@shared/types').GCodeResult>
      exportGCode: (gcode: string[]) => Promise<string | null>
      loadWindFile: () => Promise<unknown | null>
      saveWindFile: (params: unknown) => Promise<string | null>
      // Serial Port
      listPorts: () => Promise<import('@shared/types').PortInfo[]>
      connect: (port: string, baudRate: number) => Promise<void>
      disconnect: () => Promise<void>
      sendCommand: (cmd: string) => Promise<void>
      startStreaming: (gcode: string[]) => Promise<void>
      pause: () => void
      resume: () => void
      abort: () => void
      jog: (axis: string, distance: number, feedRate: number) => void
      jogCancel: () => void
      home: () => void
      unlock: () => void
      zeroAxes: () => void
      goToOrigin: () => void
      sendSettings: (settings: string[]) => void
      motorTest: (axis: string) => void
      // Events
      onSerialData: (cb: (data: string) => void) => () => void
      onGrblStatus: (cb: (status: import('@shared/types').GrblStatus) => void) => () => void
      onStreamProgress: (cb: (progress: import('@shared/types').StreamProgress) => void) => () => void
      onConnectionStatus: (cb: (status: import('@shared/types').ConnectionStatus) => void) => () => void
      onSerialError: (cb: (error: string) => void) => () => void
    }
  }
}
