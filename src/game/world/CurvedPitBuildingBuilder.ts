/**
 * CurvedPitBuildingBuilder.ts - Next-Gen FIA Grade-1 Aerodynamic Pit Building & F1 Garage Architecture
 *
 * Professional Contemporary Motorsport Paddock Architecture:
 * - Authentic Contemporary F1 Garage Interior: Matte 2x2 twill carbon fiber composites,
 *   brushed 316 stainless steel, polished industrial epoxy floor with laser-alignment guides,
 *   multi-screen live telemetry engineering islands, Pirelli Cordura tire warming jackets,
 *   quick-lift titanium jacks, and modular motorsport flight-case roll-cabs.
 * - Zero "toy" or cartoon primary colors: Authentically calibrated PBR materials, deep graphite finishes,
 *   and surgical 5500K lighting.
 * - Hardware GPU InstancedMesh for overhead surgical lighting troffers (Zero CPU geometry duplication).
 * - Single-pass BufferGeometryUtils merging for minimal GPU draw calls.
 */

import * as THREE from 'three';
import { safeMergeBufferGeometries } from '../utils/GeometryUtils';

export interface GarageTeamConfig {
  id: string;
  name: string;
  num: string;
  color: number;
  accent: number;
  x: number;
  textCol: string;
  sponsor: string;
}

export class CurvedPitBuildingBuilder {
  // Static GPU Texture Caches to prevent memory thrashing and duplicate allocations
  private static carbonTexCache?: THREE.CanvasTexture;
  private static epoxyTexCache?: THREE.CanvasTexture;
  private static blanketTexCache = new Map<string, THREE.CanvasTexture>();
  private static telemetryTexCache = new Map<string, THREE.CanvasTexture>();
  private static teamHeaderTexCache = new Map<string, THREE.CanvasTexture>();
  private static shutterTexCache = new Map<string, THREE.CanvasTexture>();

  /**
   * Generates or retrieves a high-definition FIA F1 motorized rear service roller shutter texture
   */
  public static createServiceShutterTexture(boxNum: string, teamLabel: string): THREE.CanvasTexture {
    const cacheKey = `${boxNum}_${teamLabel}`;
    const cached = this.shutterTexCache.get(cacheKey);
    if (cached) return cached;

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Dark industrial metal background
    ctx.fillStyle = '#161920';
    ctx.fillRect(0, 0, 512, 512);

    // Corrugated horizontal roll-up shutter slats
    const slatHeight = 16;
    for (let y = 0; y < 512; y += slatHeight) {
      const grad = ctx.createLinearGradient(0, y, 0, y + slatHeight);
      grad.addColorStop(0, '#2e3542');
      grad.addColorStop(0.3, '#3b4353');
      grad.addColorStop(0.7, '#232832');
      grad.addColorStop(1, '#13161c');
      ctx.fillStyle = grad;
      ctx.fillRect(0, y, 512, slatHeight - 2);

      // Subtle metallic highlight ridge
      ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.fillRect(0, y, 512, 2);

      // Slat groove shadow
      ctx.fillStyle = '#0a0c10';
      ctx.fillRect(0, y + slatHeight - 2, 512, 2);
    }

    // Safety hazard chevron stripes at bottom threshold
    const hazardHeight = 36;
    const hazardY = 512 - hazardHeight;
    ctx.fillStyle = '#101216';
    ctx.fillRect(0, hazardY, 512, hazardHeight);
    ctx.fillStyle = '#facc15';
    for (let x = -36; x < 512 + 36; x += 36) {
      ctx.beginPath();
      ctx.moveTo(x, hazardY + hazardHeight);
      ctx.lineTo(x + 18, hazardY + hazardHeight);
      ctx.lineTo(x + 36, hazardY);
      ctx.lineTo(x + 18, hazardY);
      ctx.closePath();
      ctx.fill();
    }

    // Central Identification Plate
    const plateW = 360;
    const plateH = 92;
    const plateX = (512 - plateW) / 2;
    const plateY = 160;

    // Dark brushed plate backing with steel border
    ctx.fillStyle = '#0f1217';
    ctx.fillRect(plateX, plateY, plateW, plateH);
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#38bdf8';
    ctx.strokeRect(plateX, plateY, plateW, plateH);

    // Stencil header
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`PADDOCK SERVICE ACCESS`, 256, plateY + 28);

    ctx.fillStyle = '#ffffff';
    ctx.font = '900 32px sans-serif';
    ctx.fillText(`BOX #${boxNum} · ${teamLabel}`, 256, plateY + 62);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 13px monospace';
    ctx.fillText(`RESTRICTED FIA MOTORSPORT AREA`, 256, plateY + 82);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.shutterTexCache.set(cacheKey, tex);
    return tex;
  }

  /**
   * Generates or retrieves a 256x256 seamless 2x2 twill carbon fiber procedural texture
   */
  public static createCarbonFiberTexture(): THREE.CanvasTexture {
    if (this.carbonTexCache) {
      return this.carbonTexCache;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#111317';
    ctx.fillRect(0, 0, 128, 128);

    const step = 8;
    for (let x = 0; x < 128; x += step) {
      for (let y = 0; y < 128; y += step) {
        const isDiagonal = ((x / step) + (y / step)) % 2 === 0;
        ctx.fillStyle = isDiagonal ? '#1a1d24' : '#0c0e12';
        ctx.fillRect(x, y, step, step);

        // Subtle weave highlight
        ctx.fillStyle = isDiagonal ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.35)';
        ctx.fillRect(x, y, step, 2);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(8, 8);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.carbonTexCache = tex;
    return tex;
  }

  /**
   * Generates or retrieves a realistic F1 multi-display telemetry engineering screen texture
   */
  public static createTelemetryScreenTexture(teamName: string, carNumber: string): THREE.CanvasTexture {
    const cacheKey = `${teamName}_${carNumber}`;
    const cached = this.telemetryTexCache.get(cacheKey);
    if (cached) return cached;

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Dark technical terminal background
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, 1024, 512);

    // Top Header: Team Telemetry Banner
    ctx.fillStyle = '#0d1524';
    ctx.fillRect(0, 0, 1024, 46);
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(0, 44, 1024, 2);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(`FIA LIVE TELEMETRY // ${teamName} // CHASSIS ${carNumber}`, 24, 30);

    ctx.fillStyle = '#38bdf8';
    ctx.font = '14px monospace';
    ctx.fillText('LIVE 120Hz FEED · DRS: READY · ERS: 88% · PIT STATUS: OPEN', 540, 30);

    // Left Box: 4-Tire Thermodynamic Heatmap
    ctx.fillStyle = '#09101d';
    ctx.fillRect(24, 60, 310, 420);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.strokeRect(24, 60, 310, 420);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('TIRE THERMAL CARCASS & PSI', 42, 90);

    const tires = [
      { label: 'FL', temp: '101°C', psi: '23.4 PSI', x: 50, y: 120, col: '#f97316' },
      { label: 'FR', temp: '105°C', psi: '23.8 PSI', x: 195, y: 120, col: '#ef4444' },
      { label: 'RL', temp: '98°C', psi: '21.2 PSI', x: 50, y: 285, col: '#22c55e' },
      { label: 'RR', temp: '102°C', psi: '21.5 PSI', x: 195, y: 285, col: '#f97316' },
    ];

    tires.forEach((t) => {
      // Tire silhouette
      ctx.fillStyle = '#1e293b';
      ctx.beginPath();
      ctx.roundRect(t.x, t.y, 90, 130, 8);
      ctx.fill();

      // Heat core gradient
      const grad = ctx.createRadialGradient(t.x + 45, t.y + 65, 10, t.x + 45, t.y + 65, 50);
      grad.addColorStop(0, t.col);
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(t.x + 6, t.y + 6, 78, 118, 6);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(t.label, t.x + 32, t.y + 40);
      ctx.font = 'bold 16px monospace';
      ctx.fillText(t.temp, t.x + 18, t.y + 75);
      ctx.font = '12px monospace';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText(t.psi, t.x + 16, t.y + 105);
    });

    // Center Box: Live Telemetry Graph (Speed vs Throttle/Brake)
    ctx.fillStyle = '#09101d';
    ctx.fillRect(355, 60, 395, 420);
    ctx.strokeStyle = '#1e293b';
    ctx.strokeRect(355, 60, 395, 420);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('SPEED & THROTTLE/BRAKE TRACE', 375, 90);

    // Grid lines
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let gy = 120; gy <= 440; gy += 40) {
      ctx.beginPath();
      ctx.moveTo(375, gy);
      ctx.lineTo(730, gy);
      ctx.stroke();
    }

    // Speed trace (Cyan line)
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(375, 360);
    ctx.bezierCurveTo(440, 220, 520, 140, 580, 260);
    ctx.bezierCurveTo(620, 340, 680, 130, 730, 160);
    ctx.stroke();

    // Throttle trace (Green line)
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(375, 410);
    ctx.lineTo(470, 280);
    ctx.lineTo(540, 280);
    ctx.lineTo(580, 420);
    ctx.lineTo(620, 420);
    ctx.lineTo(660, 280);
    ctx.lineTo(730, 280);
    ctx.stroke();

    // Brake spikes (Red line)
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(375, 440);
    ctx.lineTo(570, 440);
    ctx.lineTo(585, 310);
    ctx.lineTo(605, 440);
    ctx.lineTo(730, 440);
    ctx.stroke();

    // Right Box: Power Unit & Sector Splits
    ctx.fillStyle = '#09101d';
    ctx.fillRect(770, 60, 230, 420);
    ctx.strokeStyle = '#1e293b';
    ctx.strokeRect(770, 60, 230, 420);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('SECTOR DELTA', 785, 90);

    const sectors = [
      { name: 'SECTOR 1', time: '26.840', diff: '-0.142s', isPurp: true },
      { name: 'SECTOR 2', time: '24.112', diff: '+0.038s', isPurp: false },
      { name: 'SECTOR 3', time: '19.924', diff: '-0.210s', isPurp: true },
    ];

    sectors.forEach((sec, idx) => {
      const sy = 120 + idx * 80;
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(785, sy, 200, 65);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px monospace';
      ctx.fillText(sec.name, 795, sy + 22);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 18px monospace';
      ctx.fillText(sec.time, 795, sy + 50);

      ctx.fillStyle = sec.isPurp ? '#c084fc' : '#22c55e';
      ctx.font = 'bold 13px monospace';
      ctx.fillText(sec.diff, 920, sy + 50);
    });

    // MGU-K Power Bar
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('MGU-K DEPLOY (120 kW)', 785, 395);

    ctx.fillStyle = '#1e293b';
    ctx.fillRect(785, 410, 200, 20);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(785, 410, 168, 20);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.telemetryTexCache.set(cacheKey, tex);
    return tex;
  }

  /**
   * Generates or retrieves a high-gloss technical epoxy floor texture with tire stall alignment marks
   */
  public static createEpoxyFloorTexture(): THREE.CanvasTexture {
    if (this.epoxyTexCache) {
      return this.epoxyTexCache;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Polished deep dark charcoal epoxy base
    ctx.fillStyle = '#131922';
    ctx.fillRect(0, 0, 512, 512);

    // Subtle expansion joints grid
    ctx.strokeStyle = '#0c1017';
    ctx.lineWidth = 3;
    for (let i = 0; i <= 512; i += 128) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, 512);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(512, i);
      ctx.stroke();
    }

    // High-visibility crisp technical yellow pit stall alignment guide lines
    ctx.fillStyle = 'rgba(234, 179, 8, 0.85)';
    ctx.fillRect(60, 40, 12, 432);
    ctx.fillRect(440, 40, 12, 432);

    // Transverse front wheel alignment box
    ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.fillRect(60, 140, 392, 10);
    ctx.fillRect(60, 360, 392, 10);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 2);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.epoxyTexCache = tex;
    return tex;
  }

  /**
   * Generates or retrieves a textured dark Cordura / Kevlar thermal tire blanket texture
   */
  public static createTireBlanketTexture(compoundColorHex: string, compoundText: string): THREE.CanvasTexture {
    const cacheKey = `${compoundColorHex}_${compoundText}`;
    const cached = this.blanketTexCache.get(cacheKey);
    if (cached) return cached;

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Dark ballistic nylon/Cordura weave
    ctx.fillStyle = '#14171d';
    ctx.fillRect(0, 0, 256, 256);

    // Subtle thermal diamond quilt stitching
    ctx.strokeStyle = '#202530';
    ctx.lineWidth = 1.5;
    for (let x = -256; x <= 512; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 256, 256);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(x, 256);
      ctx.lineTo(x + 256, 0);
      ctx.stroke();
    }

    // Outer perimeter compound color identification pinstripe
    ctx.fillStyle = compoundColorHex;
    ctx.fillRect(0, 0, 256, 14);
    ctx.fillRect(0, 242, 256, 14);

    // Digital Thermal Controller Box Badge
    ctx.fillStyle = '#090d14';
    ctx.fillRect(48, 80, 160, 96);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.strokeRect(48, 80, 160, 96);

    // LED Temp Display
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('100°C', 128, 125);

    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 14px monospace';
    ctx.fillText(`F1 · ${compoundText}`, 128, 155);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.blanketTexCache.set(cacheKey, tex);
    return tex;
  }

  public static buildCurvedPitBuilding(
    materials: {
      metalDarkMat: THREE.Material;
      metalSilverMat: THREE.Material;
      glassMat: THREE.Material;
      concreteMat: THREE.Material;
    },
    buildingLength: number = 96,
    buildingCenter: { x: number; y: number; z: number } = { x: -2.0, y: 0, z: -99.0 }
  ): THREE.Group {
    const rootGroup = new THREE.Group();
    rootGroup.name = 'CurvedAerodynamicPitBuilding';

    // Arrays to collect geometries for single-pass GPU merging
    const exteriorDarkMetalGeos: THREE.BufferGeometry[] = [];
    const interiorDarkMetalGeos: THREE.BufferGeometry[] = [];
    const exteriorSilverGeos: THREE.BufferGeometry[] = [];
    const interiorSilverGeos: THREE.BufferGeometry[] = [];
    const concreteGeos: THREE.BufferGeometry[] = [];
    const glassGeos: THREE.BufferGeometry[] = [];

    // Contemporary PBR Collections
    const carbonCompositeGeos: THREE.BufferGeometry[] = [];
    const brushedStainlessGeos: THREE.BufferGeometry[] = [];
    const epoxyFloorGeos: THREE.BufferGeometry[] = [];
    const interiorWallGeos: THREE.BufferGeometry[] = [];
    const emissiveWhiteGeos: THREE.BufferGeometry[] = [];
    const pneumaticHoseGeos: THREE.BufferGeometry[] = [];
    const tireSoftGeos: THREE.BufferGeometry[] = [];
    const tireMedGeos: THREE.BufferGeometry[] = [];
    const tireHardGeos: THREE.BufferGeometry[] = [];
    const wheelRimGeos: THREE.BufferGeometry[] = [];
    const safetyYellowGeos: THREE.BufferGeometry[] = [];

    const halfLen = buildingLength / 2;
    const midX = buildingCenter.x;
    const frontZ = buildingCenter.z;

    // =========================================================================
    // 1. AERODYNAMIC MAIN CANTILEVER ROOF & COMPOSITE FASCIA
    // =========================================================================
    const roofCurvePoints = [
      new THREE.Vector2(-halfLen - 2.0, frontZ + 1.8),
      new THREE.Vector2(-halfLen * 0.5, frontZ + 0.3),
      new THREE.Vector2(0, frontZ - 0.2),
      new THREE.Vector2(halfLen * 0.5, frontZ + 0.3),
      new THREE.Vector2(halfLen + 2.0, frontZ + 1.8),
    ];
    const roofSpline = new THREE.SplineCurve(roofCurvePoints);
    const splinePoints = roofSpline.getPoints(50);

    const roofShape = new THREE.Shape();
    roofShape.moveTo(splinePoints[0].x, splinePoints[0].y);
    splinePoints.forEach((pt) => roofShape.lineTo(pt.x, pt.y));
    roofShape.lineTo(halfLen + 2.0, frontZ + 7.8);
    roofShape.lineTo(-halfLen - 2.0, frontZ + 7.8);
    roofShape.closePath();

    const roofGeo = new THREE.ExtrudeGeometry(roofShape, {
      depth: 0.9,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.35,
      bevelThickness: 0.35,
    });
    roofGeo.rotateX(Math.PI / 2);
    roofGeo.translate(0, 11.2, 0);
    exteriorDarkMetalGeos.push(roofGeo);

    // Brushed Silver Leading Edge Blade
    const leadingBladeShape = new THREE.Shape();
    leadingBladeShape.moveTo(splinePoints[0].x, splinePoints[0].y);
    splinePoints.forEach((pt) => leadingBladeShape.lineTo(pt.x, pt.y));
    leadingBladeShape.lineTo(halfLen + 2.0, frontZ + 0.6);
    for (let i = splinePoints.length - 1; i >= 0; i--) {
      leadingBladeShape.lineTo(splinePoints[i].x, splinePoints[i].y + 0.4);
    }
    leadingBladeShape.closePath();

    const leadingBladeGeo = new THREE.ExtrudeGeometry(leadingBladeShape, {
      depth: 0.45,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.08,
      bevelThickness: 0.08,
    });
    leadingBladeGeo.rotateX(Math.PI / 2);
    leadingBladeGeo.translate(0, 11.35, 0);
    exteriorSilverGeos.push(leadingBladeGeo);

    // =========================================================================
    // 2. SCULPTED AERO-CANOPY WING (Wind-Tunnel Profile Extending Over Pit Lane)
    // =========================================================================
    const wingShape = new THREE.Shape();
    wingShape.moveTo(-11.5, 7.6);
    wingShape.quadraticCurveTo(-6.0, 9.4, 6.8, 9.2);
    wingShape.lineTo(7.0, 8.8);
    wingShape.quadraticCurveTo(-4.0, 8.6, -11.2, 7.3);
    wingShape.lineTo(-11.5, 7.6);

    const wingCanopyGeo = new THREE.ExtrudeGeometry(wingShape, {
      depth: buildingLength + 4.0,
      bevelEnabled: true,
      bevelSegments: 4,
      steps: 1,
      bevelSize: 0.20,
      bevelThickness: 0.20,
    });
    wingCanopyGeo.rotateY(Math.PI / 2);
    wingCanopyGeo.translate(midX - (buildingLength + 4.0) / 2, 0, buildingCenter.z);
    exteriorSilverGeos.push(wingCanopyGeo);

    // =========================================================================
    // 3. LEVEL-2 CURVED VIP HOSPITALITY & RACE CONTROL LOUNGE
    // =========================================================================
    const loungeGlassPoints = [
      new THREE.Vector2(-halfLen + 2.0, frontZ + 1.2),
      new THREE.Vector2(-halfLen * 0.45, frontZ - 0.4),
      new THREE.Vector2(0, frontZ - 0.9),
      new THREE.Vector2(halfLen * 0.45, frontZ - 0.4),
      new THREE.Vector2(halfLen - 2.0, frontZ + 1.2),
    ];
    const glassSpline = new THREE.SplineCurve(loungeGlassPoints);
    const glassSplinePts = glassSpline.getPoints(40);

    const glassWallShape = new THREE.Shape();
    glassWallShape.moveTo(glassSplinePts[0].x, glassSplinePts[0].y);
    glassSplinePts.forEach((pt) => glassWallShape.lineTo(pt.x, pt.y));
    glassWallShape.lineTo(halfLen - 2.0, frontZ + 1.6);
    for (let p = glassSplinePts.length - 1; p >= 0; p--) {
      glassWallShape.lineTo(glassSplinePts[p].x, glassSplinePts[p].y + 0.35);
    }
    glassWallShape.closePath();

    const glassExtrude = new THREE.ExtrudeGeometry(glassWallShape, {
      depth: 3.2,
      bevelEnabled: false,
    });
    glassExtrude.rotateX(Math.PI / 2);
    glassExtrude.translate(0, 8.4, 0);
    glassGeos.push(glassExtrude);

    // Race Control Observation Capsule Pod
    const podShape = new THREE.Shape();
    podShape.moveTo(-7.5, 0);
    podShape.quadraticCurveTo(0, -2.8, 7.5, 0);
    podShape.lineTo(7.2, 1.8);
    podShape.lineTo(-7.2, 1.8);
    podShape.closePath();

    const podGeo = new THREE.ExtrudeGeometry(podShape, {
      depth: 2.8,
      bevelEnabled: true,
      bevelSegments: 3,
      bevelSize: 0.12,
      bevelThickness: 0.12,
    });
    podGeo.rotateX(Math.PI / 2);
    podGeo.translate(midX, 6.7, frontZ - 1.2);
    exteriorDarkMetalGeos.push(podGeo);

    // Pod Glass Prow
    const podGlassGeo = new THREE.CylinderGeometry(6.8, 6.8, 2.2, 24, 1, false, Math.PI * 0.72, Math.PI * 0.56);
    podGlassGeo.translate(midX, 6.6, frontZ - 0.8);
    glassGeos.push(podGlassGeo);

    // =========================================================================
    // 4. STREAMLINED COMPOSITE COLUMNS & GARAGE BAYS (Ground Level)
    // =========================================================================
    const garageConfigs: GarageTeamConfig[] = [
      { id: 'p1', name: 'GARAGE 01 · PILOTO 1', num: '#1 HOST', color: 0x1d4ed8, accent: 0x38bdf8, x: -22.0, textCol: '#ffffff', sponsor: 'APEX SCUDERIA' },
      { id: 'p2', name: 'GARAGE 02 · PILOTO 2', num: '#2 RIVAL', color: 0xdc2626, accent: 0xfacc15, x: 22.0, textCol: '#ffffff', sponsor: 'CORSA RACING' },
    ];

    const colSpacing = 11.0;
    for (let xCol = -halfLen + midX; xCol <= halfLen + midX; xCol += colSpacing) {
      const colGeo = new THREE.CylinderGeometry(0.38, 0.44, 5.2, 16);
      colGeo.scale(1.1, 1.0, 1.8);
      colGeo.translate(xCol, 2.6, frontZ + 0.15);
      exteriorDarkMetalGeos.push(colGeo);

      const ribGeo = new THREE.BoxGeometry(0.12, 5.2, 0.18);
      ribGeo.translate(xCol, 2.6, frontZ - 0.55);
      exteriorSilverGeos.push(ribGeo);
    }

    // =========================================================================
    // 4.1. DELIMITACIÓN AMARILLA DE PIT STALLS Y TRABAJO EN BOXES
    // Ajustada a la longitud de los 7 boxes de garaje (78m) para no prolongarse
    // excesivamente hacia las vías de entrada y salida del pit lane.
    // =========================================================================
    const pitStallLinesLength = 78.0;

    // Línea de delimitación de seguridad del carril de trabajo (Working Lane Yellow Line)
    const workingLaneLine = new THREE.PlaneGeometry(pitStallLinesLength, 0.32);
    workingLaneLine.rotateX(-Math.PI / 2);
    workingLaneLine.translate(midX, 0.012, frontZ - 8.2);
    safetyYellowGeos.push(workingLaneLine);

    // Línea exterior delimitadora de la zona de parada del coche
    const outerPitBoxLimitLine = new THREE.PlaneGeometry(pitStallLinesLength, 0.24);
    outerPitBoxLimitLine.rotateX(-Math.PI / 2);
    outerPitBoxLimitLine.translate(midX, 0.012, frontZ - 13.8);
    safetyYellowGeos.push(outerPitBoxLimitLine);

    // =========================================================================
    // 4.2. SUELOS DE GARAJE Y CERRAMIENTO ESTRUCTURAL TRASERO
    // =========================================================================
    // High-Gloss Technical Epoxy Resin Floor with Tire Alignment Guides
    const bayFloorGeo = new THREE.PlaneGeometry(buildingLength - 0.5, 7.3);
    bayFloorGeo.rotateX(-Math.PI / 2);
    bayFloorGeo.translate(midX, 0.08, frontZ + 3.65);
    epoxyFloorGeos.push(bayFloorGeo);

    const garageDepth = 7.3;
    const rearWallZ = frontZ + garageDepth; // -91.70

    // Muro estructural posterior de cerramiento (3D sólido con espesor de 0.45m)
    const rearMainWallGeo = new THREE.BoxGeometry(buildingLength, 5.2, 0.45);
    rearMainWallGeo.translate(midX, 2.6, rearWallZ + 0.22);
    concreteGeos.push(rearMainWallGeo);

    // Muro interior divisorio acústico de garajes (cara interior)
    const interiorRearWallGeo = new THREE.PlaneGeometry(buildingLength - 0.5, 5.0);
    interiorRearWallGeo.translate(midX, 2.5, rearWallZ - 0.02);
    interiorWallGeos.push(interiorRearWallGeo);

    // Cerramientos laterales de los boxes (Fachadas Oeste y Este cerrando la nave)
    const westEndWallGeo = new THREE.BoxGeometry(0.45, 5.2, garageDepth + 0.3);
    westEndWallGeo.translate(midX - halfLen, 2.6, frontZ + garageDepth / 2);
    concreteGeos.push(westEndWallGeo);

    const eastEndWallGeo = new THREE.BoxGeometry(0.45, 5.2, garageDepth + 0.3);
    eastEndWallGeo.translate(midX + halfLen, 2.6, frontZ + garageDepth / 2);
    concreteGeos.push(eastEndWallGeo);

    // Techo estructural cerrado de la planta baja de los boxes
    const garageCeilingGeo = new THREE.BoxGeometry(buildingLength, 0.25, garageDepth + 0.3);
    garageCeilingGeo.translate(midX, 5.25, frontZ + garageDepth / 2);
    exteriorDarkMetalGeos.push(garageCeilingGeo);

    // Muros divisorios interiores entre boxes adyacentes y pilares traseros exteriores
    for (let xCol = -halfLen + midX + colSpacing; xCol <= halfLen + midX - colSpacing; xCol += colSpacing) {
      const dividerWallGeo = new THREE.BoxGeometry(0.18, 5.0, garageDepth - 0.6);
      dividerWallGeo.translate(xCol, 2.5, frontZ + garageDepth / 2);
      interiorWallGeos.push(dividerWallGeo);

      // Pilares traseros estructurales exteriores
      const rearColumnGeo = new THREE.BoxGeometry(0.55, 5.2, 0.55);
      rearColumnGeo.translate(xCol, 2.6, rearWallZ + 0.35);
      exteriorDarkMetalGeos.push(rearColumnGeo);

      // Líneas transversales amarillas de delimitación de boxes en el asfalto
      const transverseDivider = new THREE.PlaneGeometry(0.22, 8.2);
      transverseDivider.rotateX(-Math.PI / 2);
      transverseDivider.translate(xCol, 0.012, frontZ - 4.1);
      safetyYellowGeos.push(transverseDivider);
    }

    // =========================================================================
    // 5. REDISEÑO CONTEMPORÁNEO F1: INTERIORES DE GARAJE DE ALTA FIDELIDAD
    // =========================================================================
    const garagePositions = [-33.0, -22.0, -11.0, 0.0, 11.0, 22.0, 33.0];

    // INSTANCED MESH SURGICAL CEILING TROFFERS (14 Luminaire Fixtures Across All Garages)
    // Instanced directly on the GPU to eliminate CPU geometry cloning and minimize draw calls
    const baseTrofferHousingGeo = new THREE.BoxGeometry(0.36, 0.08, 5.6);
    const baseTrofferLightGeo = new THREE.BoxGeometry(0.24, 0.04, 5.4);
    const totalTroffers = garagePositions.length * 2;

    const trofferHousingInst = new THREE.InstancedMesh(baseTrofferHousingGeo, materials.metalDarkMat, totalTroffers);
    trofferHousingInst.castShadow = false;
    trofferHousingInst.receiveShadow = false;

    const emissiveWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xf8fafc,
      emissiveIntensity: 4.8,
      roughness: 0.1,
    });
    const trofferLightInst = new THREE.InstancedMesh(baseTrofferLightGeo, emissiveWhiteMat, totalTroffers);
    trofferLightInst.castShadow = false;
    trofferLightInst.receiveShadow = false;

    let trofferIdx = 0;
    const dummyTroffer = new THREE.Object3D();

    garagePositions.forEach((gX, idx) => {
      const isHost = Math.abs(gX - (-22.0)) < 2.0;
      const isRival = Math.abs(gX - 22.0) < 2.0;
      const teamTitle = isHost ? 'APEX SCUDERIA' : isRival ? 'CORSA RACING' : `FIA PADDOCK TEAM 0${idx + 1}`;
      const carNum = isHost ? '#1' : isRival ? '#2' : `#${idx + 1}`;

      // A. ILUMINACIÓN CENITAL QUIRÚRGICA LED (Dual 5500K Linear Troffers via InstancedMesh)
      [-1.8, 1.8].forEach((xTroff) => {
        dummyTroffer.position.set(gX + xTroff, 4.82, frontZ + 3.8);
        dummyTroffer.updateMatrix();
        trofferHousingInst.setMatrixAt(trofferIdx, dummyTroffer.matrix);

        dummyTroffer.position.set(gX + xTroff, 4.79, frontZ + 3.8);
        dummyTroffer.updateMatrix();
        trofferLightInst.setMatrixAt(trofferIdx, dummyTroffer.matrix);
        trofferIdx++;
      });

      // B. MAMPARAS ACÚSTICAS DIVISORIAS DE CARBONO ENTRE BAHÍAS
      [-5.4, 5.4].forEach((xDiv) => {
        const divPanelGeo = new THREE.BoxGeometry(0.08, 3.8, 6.8);
        divPanelGeo.translate(gX + xDiv, 1.9, frontZ + 3.6);
        carbonCompositeGeos.push(divPanelGeo);

        const divTrimGeo = new THREE.BoxGeometry(0.12, 0.08, 6.8);
        divTrimGeo.translate(gX + xDiv, 3.82, frontZ + 3.6);
        interiorSilverGeos.push(divTrimGeo);

        // Subtle vertical LED accent strip
        const ledStripGeo = new THREE.BoxGeometry(0.02, 3.2, 0.04);
        ledStripGeo.translate(gX + xDiv, 1.8, frontZ + 0.3);
        emissiveWhiteGeos.push(ledStripGeo);
      });

      // C. ESTACIÓN DE TELEMETRÍA DE INGENIERÍA CURVA (Multi-Pantalla con Gráficas Reales)
      // Consola de fibra de carbono aeroespacial
      const consoleBenchGeo = new THREE.BoxGeometry(4.8, 0.88, 1.1);
      consoleBenchGeo.translate(gX, 0.44, frontZ + 6.4);
      carbonCompositeGeos.push(consoleBenchGeo);

      const consoleTopGeo = new THREE.BoxGeometry(4.9, 0.06, 1.2);
      consoleTopGeo.translate(gX, 0.91, frontZ + 6.4);
      brushedStainlessGeos.push(consoleTopGeo);

      // Pantallas de telemetría multi-panel con soporte de aluminio articulado
      const monitorMountGeo = new THREE.BoxGeometry(4.4, 0.08, 0.12);
      monitorMountGeo.translate(gX, 1.85, frontZ + 6.65);
      interiorSilverGeos.push(monitorMountGeo);

      // Pantallas de telemetría unificadas en 1 sola malla por box
      const screenGeos: THREE.BufferGeometry[] = [];
      const centerScreenGeo = new THREE.PlaneGeometry(2.4, 1.15);
      centerScreenGeo.translate(gX, 2.05, frontZ + 6.6);
      screenGeos.push(centerScreenGeo);

      // Pantallas laterales orientadas hacia el centro
      [-1.8, 1.8].forEach((xSide, sIdx) => {
        const sideScreenGeo = new THREE.PlaneGeometry(1.05, 0.95);
        sideScreenGeo.rotateY(sIdx === 0 ? 0.22 : -0.22);
        sideScreenGeo.translate(gX + xSide, 2.05, frontZ + 6.55);
        screenGeos.push(sideScreenGeo);
      });

      const screenTex = CurvedPitBuildingBuilder.createTelemetryScreenTexture(teamTitle, carNum);
      const screenMat = new THREE.MeshBasicMaterial({ map: screenTex });
      const mergedScreens = safeMergeBufferGeometries(screenGeos);
      if (mergedScreens) {
        const screensMesh = new THREE.Mesh(mergedScreens, screenMat);
        rootGroup.add(screensMesh);
      }

      // D. CARROS DE HERRAMIENTAS MODULARES SNAP-ON / BETA EN GRAFITO Y ACERO INOXIDABLE
      [-4.3, 4.3].forEach((xCab) => {
        // Cuerpo del carro en grafito industrial
        const cartBody = new THREE.BoxGeometry(0.95, 1.35, 3.4);
        cartBody.translate(gX + xCab, 0.68, frontZ + 4.8);
        interiorDarkMetalGeos.push(cartBody);

        // Encimera en acero inoxidable cepillado con reborde de seguridad
        const cartTop = new THREE.BoxGeometry(1.02, 0.08, 3.48);
        cartTop.translate(gX + xCab, 1.39, frontZ + 4.8);
        brushedStainlessGeos.push(cartTop);

        // Cantoneras y esquineros protectores tipo flight-case
        [-0.48, 0.48].forEach((cx) => {
          [-1.68, 1.68].forEach((cz) => {
            const cornerCap = new THREE.BoxGeometry(0.06, 1.35, 0.06);
            cornerCap.translate(gX + xCab + cx, 0.68, frontZ + 4.8 + cz);
            interiorSilverGeos.push(cornerCap);
          });
        });

        // Cajones y tiradores horizontales de aluminio
        for (let d = 0; d < 5; d++) {
          const drawerPull = new THREE.BoxGeometry(0.04, 0.03, 3.1);
          drawerPull.translate(gX + xCab + (xCab > 0 ? -0.49 : 0.49), 0.25 + d * 0.24, frontZ + 4.8);
          interiorSilverGeos.push(drawerPull);
        }

        // Pistola de impacto Paoli en soporte lateral de acero
        const gunHolder = new THREE.BoxGeometry(0.18, 0.12, 0.14);
        gunHolder.translate(gX + xCab + (xCab > 0 ? -0.55 : 0.55), 1.15, frontZ + 3.8);
        interiorSilverGeos.push(gunHolder);

        const wheelGunBody = new THREE.CylinderGeometry(0.04, 0.05, 0.28, 8);
        wheelGunBody.rotateZ(Math.PI / 2);
        wheelGunBody.translate(gX + xCab + (xCab > 0 ? -0.55 : 0.55), 1.25, frontZ + 3.8);
        interiorDarkMetalGeos.push(wheelGunBody);

        // Ruedas industriales del carro de herramientas
        [-1.4, 1.4].forEach((zWheel) => {
          const wheelGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.06, 8);
          wheelGeo.rotateZ(Math.PI / 2);
          wheelGeo.translate(gX + xCab, 0.07, frontZ + 4.8 + zWheel);
          interiorDarkMetalGeos.push(wheelGeo);
        });
      });

      // E. BANCADA DE BOTELLAS DE NITRÓGENO DE ALTA PRESIÓN CON MANÓMETROS
      [-4.2, 4.2].forEach((xSide) => {
        for (let b = 0; b < 2; b++) {
          const bottleZ = frontZ + 2.8 + b * 0.55;
          // Botella de composite negro con cuello de latón
          const tankGeo = new THREE.CylinderGeometry(0.14, 0.14, 1.5, 12);
          tankGeo.translate(gX + xSide, 0.85, bottleZ);
          interiorDarkMetalGeos.push(tankGeo);

          const tankCapGeo = new THREE.SphereGeometry(0.14, 12, 8);
          tankCapGeo.translate(gX + xSide, 1.6, bottleZ);
          interiorDarkMetalGeos.push(tankCapGeo);

          // Regulador y manómetro doble de presión
          const valveGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
          valveGeo.translate(gX + xSide, 1.76, bottleZ);
          interiorSilverGeos.push(valveGeo);

          // Esferas analógicas de manómetro
          const gaugeGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.03, 10);
          gaugeGeo.rotateX(Math.PI / 2);
          gaugeGeo.translate(gX + xSide + (xSide > 0 ? -0.08 : 0.08), 1.82, bottleZ);
          interiorSilverGeos.push(gaugeGeo);

          // Manguera en espiral de poliuretano industrial
          const spiralCurve = new THREE.CatmullRomCurve3([
            new THREE.Vector3(gX + xSide, 1.76, bottleZ),
            new THREE.Vector3(gX + xSide + (xSide > 0 ? -0.25 : 0.25), 1.45, bottleZ - 0.2),
            new THREE.Vector3(gX + xSide + (xSide > 0 ? -0.45 : 0.45), 0.95, bottleZ - 0.3),
            new THREE.Vector3(gX + xSide + (xSide > 0 ? -0.35 : 0.35), 0.35, bottleZ - 0.4),
          ]);
          const hoseGeo = new THREE.TubeGeometry(spiralCurve, 12, 0.025, 6, false);
          pneumaticHoseGeos.push(hoseGeo);
        }
      });

      // F. RACKS MÓVILES DE NEUMÁTICOS CON MANTAS TÉRMICAS DE KEVLAR Y LLANTAS FORJADAS
      const tireConfigs = [
        { xOff: -3.6, zOff: 2.1, geos: tireSoftGeos, colHex: '#ef4444', label: 'SOFT' },
        { xOff: 3.6, zOff: 2.1, geos: tireMedGeos, colHex: '#facc15', label: 'MED' },
        { xOff: 3.6, zOff: 3.4, geos: tireHardGeos, colHex: '#ffffff', label: 'HARD' },
      ];

      tireConfigs.forEach(({ xOff, zOff, geos }) => {
        // Carretilla móvil tubular en acero inoxidable
        const trolleyBase = new THREE.BoxGeometry(0.88, 0.10, 0.88);
        trolleyBase.translate(gX + xOff, 0.06, frontZ + zOff);
        interiorSilverGeos.push(trolleyBase);

        // 4 neumáticos apilados en manta térmica Cordura con llanta visible en la parte superior
        for (let t = 0; t < 4; t++) {
          const tY = 0.18 + t * 0.33;
          // Manta térmica texturizada
          const tGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.31, 18);
          tGeo.translate(gX + xOff, tY, frontZ + zOff);
          geos.push(tGeo);

          // Llanta de magnesio forjada con tuerca central monobloque visible en la rueda superior
          if (t === 3) {
            const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.04, 16);
            rimGeo.translate(gX + xOff, tY + 0.14, frontZ + zOff);
            wheelRimGeos.push(rimGeo);

            const nutGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.08, 6);
            nutGeo.translate(gX + xOff, tY + 0.16, frontZ + zOff);
            brushedStainlessGeos.push(nutGeo);
          }
        }
      });

      // G. GATO HIDRÁULICO DE ELEVACIÓN RÁPIDA F1 (Titanio / Cromo en suelo)
      [-1.8, 1.8].forEach((xJack) => {
        const jackZ = frontZ + 1.2;
        // Chasis del gato
        const jackBody = new THREE.BoxGeometry(0.45, 0.14, 0.95);
        jackBody.translate(gX + xJack, 0.09, jackZ);
        interiorDarkMetalGeos.push(jackBody);

        // Palanca larga de elevación cromada
        const jackArmCurve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(gX + xJack, 0.10, jackZ - 0.4),
          new THREE.Vector3(gX + xJack, 0.35, jackZ - 0.7),
          new THREE.Vector3(gX + xJack, 0.75, jackZ - 1.2),
        ]);
        const jackArmGeo = new THREE.TubeGeometry(jackArmCurve, 10, 0.03, 6, false);
        brushedStainlessGeos.push(jackArmGeo);

        // Ruedas del gato
        [-0.24, 0.24].forEach((xw) => {
          const wGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.04, 8);
          wGeo.rotateZ(Math.PI / 2);
          wGeo.translate(gX + xJack + xw, 0.05, jackZ);
          interiorSilverGeos.push(wGeo);
        });
      });

      // H. PUERTAS SECCIONALES METÁLICAS ENROLLADAS EN EL TECHO FRONTAL
      const rollDoorGeo = new THREE.PlaneGeometry(9.2, 0.95);
      rollDoorGeo.translate(gX, 4.05, frontZ + 0.05);
      exteriorSilverGeos.push(rollDoorGeo);

      // I. PORTÓN DE SERVICIO TRASERO MOTORIZADO Y ACCESO PEATONAL DE EQUIPO AL PADDOCK
      const shutterNumStr = isHost ? '01' : isRival ? '02' : `0${idx + 1}`;
      const shutterTex = CurvedPitBuildingBuilder.createServiceShutterTexture(shutterNumStr, teamTitle);
      const shutterMat = new THREE.MeshStandardMaterial({
        map: shutterTex,
        roughness: 0.42,
        metalness: 0.60,
      });

      // Cara exterior e interior del portón unificadas en 1 sola malla
      const extShutterGeo = new THREE.PlaneGeometry(6.8, 3.8);
      extShutterGeo.translate(gX, 1.9, rearWallZ + 0.46);

      const intShutterGeo = new THREE.PlaneGeometry(6.8, 3.8);
      intShutterGeo.rotateY(Math.PI);
      intShutterGeo.translate(gX, 1.9, rearWallZ - 0.03);

      const mergedShutters = safeMergeBufferGeometries([extShutterGeo, intShutterGeo]);
      if (mergedShutters) {
        const shutterMesh = new THREE.Mesh(mergedShutters, shutterMat);
        rootGroup.add(shutterMesh);
      }

      // Guías de acero y dintel del portón
      const leftGuide = new THREE.BoxGeometry(0.20, 3.9, 0.28);
      leftGuide.translate(gX - 3.45, 1.95, rearWallZ + 0.38);
      exteriorSilverGeos.push(leftGuide);

      const rightGuide = new THREE.BoxGeometry(0.20, 3.9, 0.28);
      rightGuide.translate(gX + 3.45, 1.95, rearWallZ + 0.38);
      exteriorSilverGeos.push(rightGuide);

      const topLintel = new THREE.BoxGeometry(7.12, 0.35, 0.28);
      topLintel.translate(gX, 3.95, rearWallZ + 0.38);
      exteriorSilverGeos.push(topLintel);

      // Tambor cilíndrico de motorización del portón
      const drumGeo = new THREE.CylinderGeometry(0.22, 0.22, 6.9, 16);
      drumGeo.rotateZ(Math.PI / 2);
      drumGeo.translate(gX, 4.3, rearWallZ + 0.38);
      exteriorDarkMetalGeos.push(drumGeo);

      // Puerta peatonal técnica de equipo con marco y manija
      const crewDoorX = gX + 4.35;
      if (Math.abs(crewDoorX - midX) < halfLen - 1.2) {
        const crewDoorGeo = new THREE.BoxGeometry(1.05, 2.35, 0.12);
        crewDoorGeo.translate(crewDoorX, 1.18, rearWallZ + 0.46);
        exteriorDarkMetalGeos.push(crewDoorGeo);

        const crewDoorFrame = new THREE.BoxGeometry(1.18, 2.45, 0.15);
        crewDoorFrame.translate(crewDoorX, 1.23, rearWallZ + 0.44);
        exteriorSilverGeos.push(crewDoorFrame);

        const doorHandle = new THREE.BoxGeometry(0.05, 0.30, 0.12);
        doorHandle.translate(crewDoorX + 0.42, 1.05, rearWallZ + 0.54);
        brushedStainlessGeos.push(doorHandle);

        const lampCasing = new THREE.BoxGeometry(0.28, 0.10, 0.20);
        lampCasing.translate(crewDoorX, 2.55, rearWallZ + 0.52);
        exteriorDarkMetalGeos.push(lampCasing);

        const lampGlass = new THREE.BoxGeometry(0.22, 0.05, 0.14);
        lampGlass.translate(crewDoorX, 2.50, rearWallZ + 0.52);
        emissiveWhiteGeos.push(lampGlass);
      }
    });

    // Finalize Instanced Lighting Troffers on GPU
    trofferHousingInst.instanceMatrix.needsUpdate = true;
    trofferHousingInst.computeBoundingSphere();
    rootGroup.add(trofferHousingInst);

    trofferLightInst.instanceMatrix.needsUpdate = true;
    trofferLightInst.computeBoundingSphere();
    rootGroup.add(trofferLightInst);

    // =========================================================================
    // 6. ARTICULATED OVERHEAD PIT BOOMS (Brazos Grúa Aéreos y Umbilicales Unificados)
    // =========================================================================
    garageConfigs.forEach((team) => {
      const bx = team.x;

      // Brazo tubular aerodinámico curvado hacia la línea de pit stop
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(bx, 5.2, frontZ),
        new THREE.Vector3(bx + 0.4, 5.4, frontZ - 1.8),
        new THREE.Vector3(bx + 0.8, 5.1, frontZ - 3.8),
        new THREE.Vector3(bx + 0.8, 4.4, frontZ - 4.6),
      ]);

      const boomTubeGeo = new THREE.TubeGeometry(curve, 16, 0.09, 8, false);
      brushedStainlessGeos.push(boomTubeGeo);

      // Línea de aire comprimido umbilical Paoli de titanio
      const dropLineGeo = new THREE.CylinderGeometry(0.025, 0.025, 2.2, 6);
      dropLineGeo.translate(bx + 0.8, 3.3, frontZ - 4.6);
      exteriorDarkMetalGeos.push(dropLineGeo);

      // Carcasa del semáforo digital de pit stop
      const gantrySignGeo = new THREE.BoxGeometry(0.65, 0.35, 0.18);
      gantrySignGeo.translate(bx + 0.8, 4.3, frontZ - 4.6);
      exteriorDarkMetalGeos.push(gantrySignGeo);

      const gantryLedGeo = new THREE.BoxGeometry(0.55, 0.25, 0.05);
      gantryLedGeo.translate(bx + 0.8, 4.3, frontZ - 4.7);
      emissiveWhiteGeos.push(gantryLedGeo);
    });

    // =========================================================================
    // 7. PANELES ARQUITECTÓNICOS SUPERIORES DE FACHADA
    // =========================================================================
    const centerLoungeGeo = new THREE.PlaneGeometry(24.0, 4.2);
    const centerLoungeCanvas = document.createElement('canvas');
    centerLoungeCanvas.width = 1024;
    centerLoungeCanvas.height = 256;
    const clCtx = centerLoungeCanvas.getContext('2d');
    if (clCtx) {
      clCtx.fillStyle = '#090d16';
      clCtx.fillRect(0, 0, 1024, 256);

      clCtx.fillStyle = '#1e293b';
      for (let c = 0; c < 8; c++) {
        clCtx.fillRect(15 + c * 125, 25, 110, 206);
      }

      clCtx.fillStyle = '#ef4444';
      clCtx.fillRect(0, 0, 1024, 12);
      clCtx.fillStyle = '#38bdf8';
      clCtx.fillRect(0, 244, 1024, 12);

      clCtx.fillStyle = '#ffffff';
      clCtx.font = 'bold 36px sans-serif';
      clCtx.textAlign = 'center';
      clCtx.fillText('FIA PADDOCK CLUB · RACE CONTROL HQ', 512, 105);

      clCtx.fillStyle = '#94a3b8';
      clCtx.font = '600 20px monospace';
      clCtx.fillText('OFFICIAL WORLD CHAMPIONSHIP GRAND PRIX PIT LANE', 512, 155);

      clCtx.fillStyle = '#facc15';
      clCtx.font = 'bold 16px sans-serif';
      clCtx.fillText('LIVE TELEMETRY · TIMING SECTOR 1 · PIT SPEED LIMIT 60 KM/H', 512, 195);
    }

    const clTex = new THREE.CanvasTexture(centerLoungeCanvas);
    clTex.colorSpace = THREE.SRGBColorSpace;
    const clMat = new THREE.MeshStandardMaterial({ map: clTex, roughness: 0.25, metalness: 0.6 });
    const centerLoungeMesh = new THREE.Mesh(centerLoungeGeo, clMat);
    centerLoungeMesh.position.set(midX, 2.3, frontZ - 0.12);
    rootGroup.add(centerLoungeMesh);

    // Rótulos de Garaje 01 y 02 (Cached Texture Generation)
    garageConfigs.forEach((team) => {
      const doorX = team.x;
      let headerTex = CurvedPitBuildingBuilder.teamHeaderTexCache.get(team.id);

      if (!headerTex) {
        const headerCanvas = document.createElement('canvas');
        headerCanvas.width = 512;
        headerCanvas.height = 128;
        const hCtx = headerCanvas.getContext('2d');
        if (hCtx) {
          const grad = hCtx.createLinearGradient(0, 0, 512, 0);
          grad.addColorStop(0, '#090d16');
          grad.addColorStop(0.30, `#${team.color.toString(16).padStart(6, '0')}`);
          grad.addColorStop(0.70, `#${team.color.toString(16).padStart(6, '0')}`);
          grad.addColorStop(1, '#090d16');
          hCtx.fillStyle = grad;
          hCtx.fillRect(0, 0, 512, 128);

          hCtx.fillStyle = `#${team.accent.toString(16).padStart(6, '0')}`;
          hCtx.fillRect(0, 0, 512, 8);
          hCtx.fillRect(0, 120, 512, 8);

          hCtx.fillStyle = team.textCol;
          hCtx.font = '900 36px sans-serif';
          hCtx.textAlign = 'center';
          hCtx.fillText(team.name, 256, 58);

          hCtx.font = 'bold 24px monospace';
          hCtx.fillStyle = '#ffffff';
          hCtx.fillText(`${team.num} · ${team.sponsor}`, 256, 98);
        }

        headerTex = new THREE.CanvasTexture(headerCanvas);
        headerTex.colorSpace = THREE.SRGBColorSpace;
        CurvedPitBuildingBuilder.teamHeaderTexCache.set(team.id, headerTex);
      }

      const headerMat = new THREE.MeshBasicMaterial({ map: headerTex });
      const headerGeo = new THREE.PlaneGeometry(9.6, 1.15);
      const headerMesh = new THREE.Mesh(headerGeo, headerMat);
      headerMesh.position.set(doorX, 4.45, frontZ - 0.12);
      rootGroup.add(headerMesh);
    });

    const addMergedOrIndividual = (
      geometries: THREE.BufferGeometry[],
      material: THREE.Material,
      castShadow: boolean = false,
      receiveShadow: boolean = false
    ) => {
      if (!geometries || geometries.length === 0) return;
      const merged = safeMergeBufferGeometries(geometries);
      if (merged) {
        const mesh = new THREE.Mesh(merged, material);
        mesh.castShadow = castShadow;
        mesh.receiveShadow = receiveShadow;
        rootGroup.add(mesh);
      } else {
        geometries.forEach((g) => {
          const mesh = new THREE.Mesh(g, material);
          mesh.castShadow = castShadow;
          mesh.receiveShadow = receiveShadow;
          rootGroup.add(mesh);
        });
      }
    };

    // =========================================================================
    // 8. BATCH MERGE ALL BUFFER GEOMETRIES (Zero Draw Call Bloat)
    // =========================================================================
    // Exterior architectural cantilever canopy & facade: Cast real-time dynamic shadows across the pit lane tarmac!
    addMergedOrIndividual(concreteGeos, materials.concreteMat, false, true);
    addMergedOrIndividual(exteriorSilverGeos, materials.metalSilverMat, true, true);
    addMergedOrIndividual(exteriorDarkMetalGeos, materials.metalDarkMat, true, true);
    addMergedOrIndividual(glassGeos, materials.glassMat, false, false);

    // Interior garage furniture & equipment: Fully sheltered under the roof canopy, receive dynamic light & shadows
    // without burdening the directional shadow map pass with tens of thousands of interior vertices!
    addMergedOrIndividual(interiorSilverGeos, materials.metalSilverMat, false, true);
    addMergedOrIndividual(interiorDarkMetalGeos, materials.metalDarkMat, false, true);

    // Contemporary PBR Materials
    const carbonTex = CurvedPitBuildingBuilder.createCarbonFiberTexture();
    const carbonMat = new THREE.MeshStandardMaterial({
      map: carbonTex,
      color: 0x22262d,
      roughness: 0.35,
      metalness: 0.30,
    });
    addMergedOrIndividual(carbonCompositeGeos, carbonMat, false, true);

    const stainlessMat = new THREE.MeshStandardMaterial({
      color: 0xc4cdd5,
      roughness: 0.28,
      metalness: 0.88,
    });
    addMergedOrIndividual(brushedStainlessGeos, stainlessMat, false, true);

    const epoxyTex = CurvedPitBuildingBuilder.createEpoxyFloorTexture();
    const epoxyMat = new THREE.MeshStandardMaterial({
      map: epoxyTex,
      roughness: 0.18,
      metalness: 0.30,
    });
    addMergedOrIndividual(epoxyFloorGeos, epoxyMat, false, true);

    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.65,
      metalness: 0.20,
    });
    addMergedOrIndividual(interiorWallGeos, wallMat, false, false);

    addMergedOrIndividual(emissiveWhiteGeos, emissiveWhiteMat, false, false);

    const hoseMat = new THREE.MeshStandardMaterial({
      color: 0x1e3a8a, // Dark industrial navy polyurethane
      roughness: 0.45,
      metalness: 0.15,
    });
    addMergedOrIndividual(pneumaticHoseGeos, hoseMat, false, false);

    // PBR Tire Warmers
    const blanketSoftTex = CurvedPitBuildingBuilder.createTireBlanketTexture('#ef4444', 'SOFT C3');
    const blanketSoftMat = new THREE.MeshStandardMaterial({ map: blanketSoftTex, roughness: 0.65, metalness: 0.1 });
    addMergedOrIndividual(tireSoftGeos, blanketSoftMat, false, true);

    const blanketMedTex = CurvedPitBuildingBuilder.createTireBlanketTexture('#facc15', 'MEDIUM C2');
    const blanketMedMat = new THREE.MeshStandardMaterial({ map: blanketMedTex, roughness: 0.65, metalness: 0.1 });
    addMergedOrIndividual(tireMedGeos, blanketMedMat, false, true);

    const blanketHardTex = CurvedPitBuildingBuilder.createTireBlanketTexture('#f8fafc', 'HARD C1');
    const blanketHardMat = new THREE.MeshStandardMaterial({ map: blanketHardTex, roughness: 0.65, metalness: 0.1 });
    addMergedOrIndividual(tireHardGeos, blanketHardMat, false, true);

    // Magnesium Forged Wheel Rims
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x27272a,
      roughness: 0.35,
      metalness: 0.85,
    });
    addMergedOrIndividual(wheelRimGeos, rimMat, false, false);

    // FIA Safety Yellow Boundary Demarcations
    const safetyYellowMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.35,
      metalness: 0.10,
    });
    addMergedOrIndividual(safetyYellowGeos, safetyYellowMat, false, true);

    return rootGroup;
  }
}
