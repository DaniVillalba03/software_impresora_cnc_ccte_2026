<div align="center">

# CCTE CNC
### Controlador CAD/CAM & Streaming G-Code para Bobinadoras de Filamento (Filament Winding)

[![Electron](https://img.shields.io/badge/Electron-33.2.0-2b2e3a?style=flat&logo=electron&logoColor=9feaf9)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18.3.1-23272f?style=flat&logo=react&logoColor=61dafb)](https://react.dev/)
[![Three.js](https://img.shields.io/badge/Three.js-r169-000000?style=flat&logo=threedotjs&logoColor=white)](https://threejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178c6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![GRBL](https://img.shields.io/badge/GRBL-1.1-16a34a?style=flat&logo=arduino&logoColor=white)](https://github.com/gnea/grbl)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

<br />

**CCTE CNC** es una aplicación de escritorio profesional de alto rendimiento diseñada para la planificación de trayectorias, simulación 3D fotorrealista y control CNC en tiempo real de máquinas bobinadoras de filamento compuesto (*Filament Winders*) para cilindros presurizados, fuselajes y tubos estructurales de fibra de carbono/vidrio.

</div>

---

## 📐 Cinemática de 3 Ejes

La aplicación está diseñada para sincronizar de forma continua tres ejes físicos de movimiento:

| Eje | Designación | Tipo | Unidad | Función en la Máquina |
|:---:|:---|:---:|:---:|:---|
| **X** | Carro Transversal | Lineal | `mm` | Desplazamiento horizontal del carro dispensador de fibra |
| **Y** | Mandril / Torno | Rotacional | `°` (grados) | Rotación continua del molde o cilindro de bobinado |
| **Z** | Cabezal Dosificador | Rotacional | `°` (grados) | Orientación angular del cabezal de entrega de fibra |

> **Nota:** El sistema permite operar en modo estándar de 3 ejes o alternar a 2 ejes mediante el toggle integrado en los ajustes de cinemática.

---

## ✨ Características Principales

### 1. 🖥️ Entorno 3D CAD/CAM (Three.js & WebGL)
- **Mandril Sólido PBR:** Simulación física de cilindro con material metálico maquinado, tapas de extremo y husillos de sujeción.
- **Visualización Volumétrica de Capas:** Renderizado de trayectorias con grosor de cinta proporcional al ancho del filamento (*Tow*), diferenciando capas circunferenciales (Azul Acero) y helicoidales (Ámbar Técnico).
- **ViewCube 3D Interactivo:** Cubo de orientación estilo Autodesk / SolidWorks con navegación suave a vistas ortogonales (Frontal, Planta, Lateral, Isométrica).
- **Optimización Extrema de GPU:** Renderizado bajo demanda (*Demand rendering*), limitación de ratio de píxeles (`dpr: 1.5`) y geometría optimizada en *BufferGeometry* (1 draw call por capa) para un rendimiento fluido en GPUs integradas.

### 2. ⚙️ Planificador de Bobinado (Trajectory Planner)
- **Capas Circunferenciales (*Hoop Winding*):** Devanado a 90° con paso continuo y opción de modo terminal (solo ida sin retorno).
- **Capas Helicoidales (*Helical Winding*):** Patrones cruzados (*criss-cross*) con cálculo exacto de ángulo de devanado ($\alpha$), *Pattern Number*, *Skip Index*, *Lock Degrees* de retención en extremos y *Lead In / Lead Out*.
- **Estimación Técnica:** Cálculo instantáneo de longitud de filamento requerida (metros) y tiempo estimado de maquinado.
- **Gestión de Recetas:** Guardado y carga de configuraciones completas en formato `.wind` / `.json`.

### 3. 🔌 Controlador GRBL & Streaming en Tiempo Real
- **Detección Automática COM:** Reconocimiento de puertos seriales USB (Arduino Uno + CNC Shield V3) a 115200 baudios.
- **Digital Readout (DRO):** Lectura en tiempo real de coordenadas de trabajo (`WPos`) para los ejes X, Y, Z.
- **Jogging Manual Preciso:** Control por pasos milimétricos en X (`0.1`, `1`, `10`, `50`, `100 mm`) y angulares en Y/Z (`1°` a `360°`), con fijación de cero de trabajo (`G92 X0 Y0 Z0`), *Home* (`$H`) y *Unlock* (`$X`).
- **Streaming de Alto Rendimiento:** Protocolo *Character-Counting* con buffer de 128 bytes que previene bloqueos por sobreflujo.
- **Seguridad Industrial:** Parada de emergencia directa (*E-STOP*) mediante soft reset (`0x18`), pausa y reanudación de ciclo.
- **Terminal Serial Integrado:** Consola interactiva con filtrado de respuestas y envío de comandos directos.

---

## 🏛️ Arquitectura del Software

```
ccte-cnc/
├── src/
│   ├── main/                    # Proceso Principal (Electron & Node.js)
│   │   ├── index.ts             # Ciclo de vida y ventana nativa
│   │   ├── ipc-handlers.ts      # Registro seguro de canales IPC
│   │   ├── grbl-controller.ts   # Driver serial GRBL (Character-Counting)
│   │   └── cyclone-adapter.ts   # Adaptador de cálculo de trayectorias
│   ├── preload/
│   │   └── index.ts             # Puente seguro ContextBridge (window.cycloneAPI)
│   ├── shared/
│   │   └── types.ts             # Definiciones TypeScript compartidas
│   ├── renderer/                # Proceso de Renderizado (React UI)
│   │   ├── index.html           # Punto de entrada HTML
│   │   └── src/
│   │       ├── App.tsx          # Layout general CAD y gestión de estado
│   │       ├── index.css        # Sistema de diseño Slate/Zinc CAD
│   │       └── components/
│   │           ├── ConfigPanel.tsx    # Parámetros de mandril, tow y cinemática
│   │           ├── LayerManager.tsx   # Stack interactivo de capas
│   │           ├── Viewport3D.tsx     # Visor 3D Three.js + ViewCube
│   │           ├── GCodePanel.tsx     # Visor G-code con syntax highlighting
│   │           └── MachineControl.tsx # Panel de control GRBL, Jog y streaming
│   └── planner/                 # Motor matemático de cálculo cinemático
├── resources/                   # Íconos y recursos de compilación
├── electron.vite.config.ts      # Configuración de compilación multi-target
├── electron-builder.yml         # Configuración del empaquetador Windows
└── package.json
```

---

## 🛠️ Requisitos de Hardware

- **Microcontrolador:** Arduino Uno R3 / Mega corriendo firmware **GRBL v1.1** (o compatible).
- **Shield CNC:** Arduino CNC Shield V3 / V4 con drivers de micropaso (A4988 / DRV8825 / TMC2209).
- **Motores:** 3 Motores paso a paso NEMA 17 / NEMA 23 para los ejes X, Y y Z.

---

## 🚀 Instalación y Puesta en Marcha

### Prerrequisitos
- [Node.js](https://nodejs.org/) v18.0 o superior
- [npm](https://www.npmjs.com/) v9.0 o superior
- [Git](https://git-scm.com/)

### 1. Clonar el repositorio
```bash
git clone https://github.com/DaniVillalba03/software_impresora_cnc_ccte_2026.git
cd software_impresora_cnc_ccte_2026
```

### 2. Instalar dependencias
```bash
npm install
```

### 3. Ejecutar en modo desarrollo
```bash
npm run dev
```

### 4. Compilar para producción
```bash
npm run build
```

### 5. Generar instalador de Windows (.exe)
```bash
npm run package
```
*El instalador generado se encontrará en la carpeta `release/` (`CCTE CNC-1.0.0-x64-setup.exe`).*

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo `LICENSE` para más información.

---

<div align="center">
Desarrollado para el proyecto <b>CCTE CNC 2026</b>
</div>
