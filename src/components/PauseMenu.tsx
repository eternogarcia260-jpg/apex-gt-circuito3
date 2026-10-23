/**
 * PauseMenu.tsx - High-End Racing Game Pause Menu
 * Clean, uncluttered UI housing camera distance selection, 3D F1 model importer,
 * vehicle repair & reset, audio preferences, and display controls.
 */

import React from 'react';
import { Play, Camera, Upload, Wrench, RotateCcw, Volume2, VolumeX, Maximize, X, Disc, AlertTriangle, LogOut, Cpu, Zap, Sparkles, Radio, Activity, Headphones } from 'lucide-react';
import { CameraDistanceMode, CameraViewMode, GameTelemetry, EngineAudioLayersState } from '../game/RacingGameEngine';
import { TIRE_COMPOUNDS, TireCompoundType } from '../game/physics/TireCompound';
import { GraphicsQualityPreset, GRAPHICS_PROFILES } from '../game/graphics/GraphicsQualityManager';

interface PauseMenuProps {
  isOpen: boolean;
  telemetry: GameTelemetry;
  onResume: () => void;
  onExitToMenu?: () => void;
  onSelectCameraDistance: (dist: CameraDistanceMode) => void;
  onSelectCameraMode: (mode: CameraViewMode) => void;
  onOpenCarUpload: () => void;
  onOpenCrewUpload: () => void;
  onRepair: () => void;
  onReset: () => void;
  onToggleAudio: () => void;
  onToggleEngineSound?: () => void;
  onSetAudioSoloLayer?: (layer: keyof EngineAudioLayersState | 'all' | 'none') => void;
  onToggleAudioLayer?: (layer: keyof EngineAudioLayersState) => void;
  onChangeTireCompound?: (compound: TireCompoundType) => void;
  graphicsQuality?: GraphicsQualityPreset;
  onChangeGraphicsQuality?: (preset: GraphicsQualityPreset) => void;
}

export const PauseMenu: React.FC<PauseMenuProps> = ({
  isOpen,
  telemetry,
  onResume,
  onExitToMenu,
  onSelectCameraDistance,
  onSelectCameraMode,
  onOpenCarUpload,
  onOpenCrewUpload,
  onRepair,
  onReset,
  onToggleAudio,
  onToggleEngineSound,
  onSetAudioSoloLayer,
  onToggleAudioLayer,
  onChangeTireCompound,
  graphicsQuality,
  onChangeGraphicsQuality,
}) => {
  if (!isOpen) return null;

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const distanceModes: { id: CameraDistanceMode; label: string }[] = [
    { id: 'near', label: 'Cerca' },
    { id: 'medium', label: 'Media' },
    { id: 'far', label: 'Lejos' },
  ];

  const cameraModes: { id: CameraViewMode; label: string; desc: string }[] = [
    { id: 'chase', label: 'Persecución', desc: 'Vista trasera dinámica' },
    { id: 'hood', label: 'Morro / Capó', desc: 'Vista frontal limpia' },
    { id: 'bumper', label: 'Alerón / Suelo', desc: 'Aero a ras de asfalto' },
    { id: 'orbit', label: 'Helicóptero TV', desc: 'Retransmisión aérea' },
  ];

  const currentCompound = TIRE_COMPOUNDS[telemetry.tireCompound] || TIRE_COMPOUNDS.soft;
  const wear = telemetry.tireWear || [0, 0, 0, 0];
  const punctures = telemetry.isPunctured || [false, false, false, false];
  const audioLayers = telemetry.audioLayers || {
    base: true,
    v12: true,
    whistle: true,
    intake: true,
    engineFilter: true,
    dcBlock: true,
  };
  const soloLayer = telemetry.audioSoloLayer || 'all';

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fade-in">
      <div className="bg-neutral-900/95 border border-white/20 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-neutral-950/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-black text-sm">
              ||
            </div>
            <div>
              <h2 className="font-black text-base text-white tracking-wider uppercase">JUEGO EN PAUSA</h2>
              <p className="text-[11px] text-neutral-400">Ajustes de cámara, vehículo y estrategia</p>
            </div>
          </div>
          <button
            onClick={onResume}
            className="p-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white transition-colors active:scale-95"
            title="Cerrar y reanudar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {/* Resume Big Button */}
          <button
            onClick={onResume}
            className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm tracking-wider uppercase flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-950/50 active:scale-[0.98] transition-all"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>REANUDAR CARRERA</span>
          </button>

          {/* Section: Performance & Graphics Quality Profile */}
          <div className="bg-black/40 border border-white/10 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-300 flex items-center gap-2">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                RENDIMIENTO Y CALIDAD GRÁFICA (GPU)
              </span>
              <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/60 border border-cyan-500/30 px-2 py-0.5 rounded">
                60 / 120 FPS ADAPTATIVO
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['low', 'medium', 'high', 'ultra'] as GraphicsQualityPreset[]).map((preset) => {
                const profile = GRAPHICS_PROFILES[preset];
                const activePreset = graphicsQuality || telemetry.graphicsQuality || 'high';
                const isSelected = activePreset === preset;

                return (
                  <button
                    key={preset}
                    onClick={() => onChangeGraphicsQuality?.(preset)}
                    className={`p-2.5 rounded-lg text-left transition-all border flex flex-col gap-1 cursor-pointer active:scale-95 ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-md shadow-cyan-950/50'
                        : 'bg-neutral-800/60 border-white/5 text-neutral-300 hover:bg-neutral-800'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold">{profile.label}</span>
                      {isSelected && <Zap className="w-3 h-3 text-cyan-400 fill-current" />}
                    </div>
                    <span className="text-[9px] font-mono text-cyan-300 leading-none">
                      {profile.targetFpsLabel}
                    </span>
                    <span className="text-[9px] text-neutral-400 leading-tight">
                      {profile.sublabel}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="text-[9px] text-neutral-400 pt-1 border-t border-white/5 flex items-center justify-between">
              <span>{GRAPHICS_PROFILES[((graphicsQuality || telemetry.graphicsQuality || 'high') as GraphicsQualityPreset)]?.description || ''}</span>
              <span className="text-neutral-500">Frame Pacer Activo</span>
            </div>
          </div>

          {/* Section: Tire Strategy & Degradation */}
          <div className="bg-black/40 border border-white/10 rounded-xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-300 flex items-center gap-2">
                <Disc className="w-3.5 h-3.5" style={{ color: currentCompound.colorCss }} />
                ESTRATEGIA Y COMPUESTOS DE NEUMÁTICOS
              </span>
              <span
                className="text-[9px] font-black px-2 py-0.5 rounded border"
                style={{
                  backgroundColor: `${currentCompound.colorCss}22`,
                  borderColor: `${currentCompound.colorCss}66`,
                  color: currentCompound.colorCss,
                }}
              >
                {currentCompound.name}
              </span>
            </div>

            {/* Tire Compound Selector Buttons */}
            {onChangeTireCompound && (
              <div className="grid grid-cols-3 gap-2">
                {(['soft', 'medium', 'hard'] as TireCompoundType[]).map((cmp) => {
                  const cfg = TIRE_COMPOUNDS[cmp];
                  const isSelected = telemetry.tireCompound === cmp;
                  return (
                    <button
                      key={cmp}
                      disabled={telemetry.isInPit}
                      onClick={() => !telemetry.isInPit && onChangeTireCompound(cmp)}
                      title={telemetry.isInPit ? 'Estrategia bloqueada durante la parada en boxes' : `Cambiar a compuesto ${cfg.name}`}
                      className={`p-2 rounded-lg text-left transition-all border flex flex-col gap-0.5 ${
                        telemetry.isInPit ? 'opacity-40 cursor-not-allowed ' : 'cursor-pointer '
                      }${
                        isSelected
                          ? 'border-white/50 shadow-md'
                          : 'bg-neutral-800/60 border-white/5 hover:bg-neutral-800'
                      }`}
                      style={{
                        backgroundColor: isSelected ? `${cfg.colorCss}25` : undefined,
                        borderColor: isSelected ? cfg.colorCss : undefined,
                      }}
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.colorCss }} />
                        <span className="text-xs font-bold text-white">{cfg.name.split(' ')[0]}</span>
                      </div>
                      <span className="text-[9px] text-neutral-400 leading-tight">
                        {cmp === 'soft' ? 'Más rápido · 3-4 vueltas' : cmp === 'medium' ? 'Equilibrado · 7-9 vueltas' : 'Duradero · 15+ vueltas'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Current 4-Wheel Wear Status */}
            <div className="grid grid-cols-4 gap-1.5 text-[8px] font-mono text-center pt-1 border-t border-white/5">
              <div className={`p-1 rounded ${punctures[0] ? 'bg-red-600 text-white animate-pulse' : 'bg-neutral-800/80 text-neutral-300'}`}>
                <div>DEL-IZQ</div>
                <div className="font-black font-sans">{punctures[0] ? 'PINCHADO' : `${Math.round(wear[0])}%`}</div>
              </div>
              <div className={`p-1 rounded ${punctures[1] ? 'bg-red-600 text-white animate-pulse' : 'bg-neutral-800/80 text-neutral-300'}`}>
                <div>DEL-DER</div>
                <div className="font-black font-sans">{punctures[1] ? 'PINCHADO' : `${Math.round(wear[1])}%`}</div>
              </div>
              <div className={`p-1 rounded ${punctures[2] ? 'bg-red-600 text-white animate-pulse' : 'bg-neutral-800/80 text-neutral-300'}`}>
                <div>TRA-IZQ</div>
                <div className="font-black font-sans">{punctures[2] ? 'PINCHADO' : `${Math.round(wear[2])}%`}</div>
              </div>
              <div className={`p-1 rounded ${punctures[3] ? 'bg-red-600 text-white animate-pulse' : 'bg-neutral-800/80 text-neutral-300'}`}>
                <div>TRA-DER</div>
                <div className="font-black font-sans">{punctures[3] ? 'PINCHADO' : `${Math.round(wear[3])}%`}</div>
              </div>
            </div>
          </div>

          {/* Section: Camera Settings */}
          <div className="bg-black/40 border border-white/10 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-neutral-300 flex items-center gap-2">
                <Camera className="w-3.5 h-3.5 text-amber-400" />
                DISTANCIA DE CÁMARA (VISTA PERSECUCIÓN)
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {distanceModes.map((dm) => {
                const isActive = telemetry.cameraDistance === dm.id && telemetry.cameraMode === 'chase';
                return (
                  <button
                    key={dm.id}
                    onClick={() => onSelectCameraDistance(dm.id)}
                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all active:scale-95 flex items-center justify-center ${
                      isActive
                        ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                        : 'bg-neutral-800/80 hover:bg-neutral-700 text-neutral-300 border border-white/5'
                    }`}
                  >
                    {dm.label}
                  </button>
                );
              })}
            </div>

            {/* Camera Perspective Modes */}
            <div className="pt-2 border-t border-white/5 space-y-2">
              <span className="text-[11px] font-semibold text-neutral-400">TIPO DE CÁMARA</span>
              <div className="grid grid-cols-2 gap-2">
                {cameraModes.map((cm) => {
                  const isActive = telemetry.cameraMode === cm.id;
                  return (
                    <button
                      key={cm.id}
                      onClick={() => onSelectCameraMode(cm.id)}
                      className={`p-2.5 rounded-lg text-left transition-all border ${
                        isActive
                          ? 'bg-amber-500/20 border-amber-500/60 text-amber-200'
                          : 'bg-neutral-800/60 border-white/5 text-neutral-300 hover:bg-neutral-800'
                      }`}
                    >
                      <div className="text-xs font-bold">{cm.label}</div>
                      <div className="text-[10px] text-neutral-400 leading-tight">{cm.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>


          {/* Section: Arquitectura Acústica Híbrida - Rugido Americano + V12 F1 */}
          <div className="bg-neutral-950/80 border border-teal-500/30 rounded-xl p-3.5 space-y-3 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/40 flex items-center justify-center shrink-0">
                  <Headphones className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-black text-white uppercase tracking-wider">
                      Acústica Profesional: Motor Grave PCM + Transmisión F1
                    </h4>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 font-bold border border-teal-500/30">
                      Muestras Dinámicas
                    </span>
                  </div>
                  <p className="text-[10px] text-neutral-400">
                    Muestras PCM de combustión real multicanal + Silbido de engranajes rectos F1 (100% libre de interferencias eléctricas)
                  </p>
                </div>
              </div>

              {/* Master Presets */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => onSetAudioSoloLayer?.('all')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all active:scale-95 cursor-pointer ${
                    soloLayer === 'all'
                      ? 'bg-teal-500 text-black shadow-md shadow-teal-500/30 font-black'
                      : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 border border-white/5'
                  }`}
                  title="Activa todas las capas del motor"
                >
                  Todas Activas
                </button>
                <button
                  onClick={() => onSetAudioSoloLayer?.('none')}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all active:scale-95 cursor-pointer ${
                    soloLayer === 'none'
                      ? 'bg-amber-500 text-black font-black'
                      : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700 border border-white/5'
                  }`}
                  title="Silencia las fuentes de síntesis"
                >
                  Silenciar
                </button>
              </div>
            </div>

            {/* Layer Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {/* Layer 1: Base PCM - Rugido Americano */}
              <div className={`p-2.5 rounded-lg border transition-all flex items-center justify-between ${
                audioLayers.base
                  ? soloLayer === 'base'
                    ? 'bg-teal-950/60 border-teal-400 text-teal-200 shadow-md shadow-teal-900/30'
                    : 'bg-neutral-900 border-white/10 text-neutral-200'
                  : 'bg-neutral-900/40 border-white/5 text-neutral-500 opacity-60'
              }`}>
                <div>
                  <div className="font-bold flex items-center gap-1.5 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                    1. Rugido Americano (Cross-Plane V8 PCM)
                  </div>
                  <div className="text-[9px] text-neutral-400">Pegada y retumbe grave profundo (muestras PCM dinámicas)</div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onSetAudioSoloLayer?.('base')}
                    className={`px-2 py-0.5 rounded text-[9px] font-black uppercase transition-all active:scale-90 cursor-pointer ${
                      soloLayer === 'base'
                        ? 'bg-teal-400 text-black shadow'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    Solo
                  </button>
                  <button
                    onClick={() => onToggleAudioLayer?.('base')}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all active:scale-90 cursor-pointer ${
                      audioLayers.base ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {audioLayers.base ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              {/* Layer 2: Aullido V12 F1 PCM */}
              <div className={`p-2.5 rounded-lg border transition-all flex items-center justify-between ${
                audioLayers.v12
                  ? soloLayer === 'v12'
                    ? 'bg-teal-950/60 border-teal-400 text-teal-200 shadow-md shadow-teal-900/30'
                    : 'bg-neutral-900 border-white/10 text-neutral-200'
                  : 'bg-neutral-900/40 border-white/5 text-neutral-500 opacity-60'
              }`}>
                <div>
                  <div className="font-bold flex items-center gap-1.5 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
                    2. Aullido V12 F1 (Escape Competición PCM)
                  </div>
                  <div className="text-[9px] text-neutral-400">Aullido agudo de colector y resonancia en altas</div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onSetAudioSoloLayer?.('v12')}
                    className={`px-2 py-0.5 rounded text-[9px] font-black uppercase transition-all active:scale-90 cursor-pointer ${
                      soloLayer === 'v12'
                        ? 'bg-teal-400 text-black shadow'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    Solo
                  </button>
                  <button
                    onClick={() => onToggleAudioLayer?.('v12')}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all active:scale-90 cursor-pointer ${
                      audioLayers.v12 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {audioLayers.v12 ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              {/* Layer 3: Silbido de Transmisión Dientes Rectos F1 */}
              <div className={`p-2.5 rounded-lg border transition-all flex items-center justify-between ${
                audioLayers.whistle
                  ? soloLayer === 'whistle'
                    ? 'bg-teal-950/60 border-teal-400 text-teal-200 shadow-md shadow-teal-900/30'
                    : 'bg-neutral-900 border-white/10 text-neutral-200'
                  : 'bg-neutral-900/40 border-white/5 text-neutral-500 opacity-60'
              }`}>
                <div>
                  <div className="font-bold flex items-center gap-1.5 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
                    3. Transmisión F1 (Dientes Rectos)
                  </div>
                  <div className="text-[9px] text-neutral-400">Silbido de engranajes rectos dog-box (aislado y sedoso)</div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onSetAudioSoloLayer?.('whistle')}
                    className={`px-2 py-0.5 rounded text-[9px] font-black uppercase transition-all active:scale-90 cursor-pointer ${
                      soloLayer === 'whistle'
                        ? 'bg-teal-400 text-black shadow'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    Solo
                  </button>
                  <button
                    onClick={() => onToggleAudioLayer?.('whistle')}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all active:scale-90 cursor-pointer ${
                      audioLayers.whistle ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {audioLayers.whistle ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              {/* Layer 4: Dynamic Airbox Intake */}
              <div className={`p-2.5 rounded-lg border transition-all flex items-center justify-between ${
                audioLayers.intake
                  ? soloLayer === 'intake'
                    ? 'bg-teal-950/60 border-teal-400 text-teal-200 shadow-md shadow-teal-900/30'
                    : 'bg-neutral-900 border-white/10 text-neutral-200'
                  : 'bg-neutral-900/40 border-white/5 text-neutral-500 opacity-60'
              }`}>
                <div>
                  <div className="font-bold flex items-center gap-1.5 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
                    4. Admisión Airbox (Garganta Dinámica)
                  </div>
                  <div className="text-[9px] text-neutral-400">Gruñido de aspiración al pisar el acelerador</div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => onSetAudioSoloLayer?.('intake')}
                    className={`px-2 py-0.5 rounded text-[9px] font-black uppercase transition-all active:scale-90 cursor-pointer ${
                      soloLayer === 'intake'
                        ? 'bg-teal-400 text-black shadow'
                        : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'
                    }`}
                  >
                    Solo
                  </button>
                  <button
                    onClick={() => onToggleAudioLayer?.('intake')}
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-all active:scale-90 cursor-pointer ${
                      audioLayers.intake ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {audioLayers.intake ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
            </div>

            {/* Filters Bypass Controls */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
              <button
                onClick={() => onToggleAudioLayer?.('engineFilter')}
                className={`px-2.5 py-2 rounded-lg border text-[10px] font-bold flex items-center justify-between transition-all cursor-pointer ${
                  audioLayers.engineFilter
                    ? 'bg-neutral-900 border-teal-500/30 text-teal-300'
                    : 'bg-neutral-900/40 border-white/5 text-neutral-400 line-through'
                }`}
              >
                <span>Filtro Motor (620-4200Hz)</span>
                <span className={`px-1.5 py-0.2 rounded text-[8px] font-black ${
                  audioLayers.engineFilter ? 'bg-teal-500/20 text-teal-300' : 'bg-neutral-800 text-neutral-400'
                }`}>
                  {audioLayers.engineFilter ? 'ACTIVO' : 'BYPASS'}
                </span>
              </button>

              <button
                onClick={() => onToggleAudioLayer?.('dcBlock')}
                className={`px-2.5 py-2 rounded-lg border text-[10px] font-bold flex items-center justify-between transition-all cursor-pointer ${
                  audioLayers.dcBlock
                    ? 'bg-neutral-900 border-teal-500/30 text-teal-300'
                    : 'bg-neutral-900/40 border-white/5 text-neutral-400 line-through'
                }`}
              >
                <span>Filtro Anti-DC (20Hz)</span>
                <span className={`px-1.5 py-0.2 rounded text-[8px] font-black ${
                  audioLayers.dcBlock ? 'bg-teal-500/20 text-teal-300' : 'bg-neutral-800 text-neutral-400'
                }`}>
                  {audioLayers.dcBlock ? 'ACTIVO' : 'BYPASS'}
                </span>
              </button>
            </div>

            <div className="text-[9px] text-neutral-400 bg-neutral-900/60 rounded-lg p-2 border border-white/5 flex items-center gap-1.5">
              <span className="text-teal-400 font-bold shrink-0">Calibración Híbrida:</span>
              <span>
                Cuerpo muscular en bajas revoluciones + aullido de monoplaza V12 F1 y silbido sinusoidal armónico en altas. Cero saturación digital ni chasquidos.
              </span>
            </div>
          </div>

          {/* Section: Quick Tools Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => {
                onRepair();
                onResume();
              }}
              className="p-3 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 border border-white/5 text-neutral-200 flex items-center gap-2.5 text-xs font-bold transition-all active:scale-95"
            >
              <Wrench className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Reparar Coche (100%)</span>
            </button>

            <button
              onClick={() => {
                onReset();
                onResume();
              }}
              className="p-3 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 border border-white/5 text-neutral-200 flex items-center gap-2.5 text-xs font-bold transition-all active:scale-95"
            >
              <RotateCcw className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Reiniciar en Pista</span>
            </button>

            <button
              onClick={onToggleAudio}
              className="p-3 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 border border-white/5 text-neutral-200 flex items-center gap-2.5 text-xs font-bold transition-all active:scale-95"
            >
              {telemetry.isMuted ? (
                <>
                  <VolumeX className="w-4 h-4 text-red-400 shrink-0" />
                  <span>Sonido General: Silenciado</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-teal-400 shrink-0" />
                  <span>Sonido General: Activado</span>
                </>
              )}
            </button>

            {onToggleEngineSound && (
              <button
                onClick={onToggleEngineSound}
                className="p-3 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 border border-white/5 text-neutral-200 flex items-center gap-2.5 text-xs font-bold transition-all active:scale-95"
              >
                {telemetry.isEngineSoundOn ? (
                  <>
                    <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Motor: Activado</span>
                  </>
                ) : (
                  <>
                    <VolumeX className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Motor: Apagado</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={handleFullscreen}
              className="p-3 rounded-xl bg-neutral-800/80 hover:bg-neutral-700 border border-white/5 text-neutral-200 flex items-center gap-2.5 text-xs font-bold transition-all active:scale-95"
            >
              <Maximize className="w-4 h-4 text-sky-400 shrink-0" />
              <span>Pantalla Completa</span>
            </button>

            {onExitToMenu && (
              <button
                onClick={onExitToMenu}
                className="p-3 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-300 flex items-center gap-2.5 text-xs font-bold transition-all active:scale-95 col-span-2 cursor-pointer"
              >
                <LogOut className="w-4 h-4 text-red-400 shrink-0" />
                <span>Salir al Menú Principal (Paddock)</span>
              </button>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="px-5 py-2.5 bg-neutral-950/80 border-t border-white/5 flex items-center justify-between text-[10px] text-neutral-500">
          <span>{telemetry.carName}</span>
          <span>Toca para reanudar la carrera</span>
        </div>
      </div>
    </div>
  );
};
