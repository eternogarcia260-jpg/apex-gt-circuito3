/**
 * CareerStudioModal.tsx - Apex Livery Studio & Team Headquarters
 * Complete customizer for driver dossier, constructor identity, procedural livery colors,
 * titanium halo finishes, and official corporate sponsors.
 */

import React, { useState } from 'react';
import {
  CustomLiverySettings,
  DEFAULT_LIVERY_SETTINGS,
  saveLivery,
} from '../game/career/CareerTypes';
import {
  X,
  Check,
  RotateCcw,
  Palette,
  User,
  Shield,
  Sparkles,
  Award,
  Car,
} from 'lucide-react';
import { playUiClick, playUiHover } from '../utils/uiAudio';

interface CareerStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLivery: CustomLiverySettings;
  onSave: (updated: CustomLiverySettings) => void;
}

interface LiveryPreset {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  haloColor: string;
  sponsorName: string;
  teamName: string;
}

const LIVERY_PRESETS: LiveryPreset[] = [
  {
    name: 'Midnight Bull',
    primaryColor: '#040814',
    secondaryColor: '#cc0022',
    accentColor: '#fec008',
    haloColor: '#0c0f16',
    sponsorName: 'ORACLE',
    teamName: 'Oracle Red Bull Racing',
  },
  {
    name: 'Rosso Corsa',
    primaryColor: '#dc2626',
    secondaryColor: '#facc15',
    accentColor: '#ffffff',
    haloColor: '#0f172a',
    sponsorName: 'SANTANDER',
    teamName: 'Scuderia Corsa',
  },
  {
    name: 'Silver Arrow',
    primaryColor: '#94a3b8',
    secondaryColor: '#06b6d4',
    accentColor: '#10b981',
    haloColor: '#0f172a',
    sponsorName: 'PETRONAS',
    teamName: 'AMG Silver Arrows',
  },
  {
    name: 'Papaya Speed',
    primaryColor: '#f97316',
    secondaryColor: '#0284c7',
    accentColor: '#ffffff',
    haloColor: '#18181b',
    sponsorName: 'CHROME',
    teamName: 'McLaren Racing',
  },
  {
    name: 'Apex British Emerald',
    primaryColor: '#064e3b',
    secondaryColor: '#10b981',
    accentColor: '#fbbf24',
    haloColor: '#022c22',
    sponsorName: 'TAG HEUER',
    teamName: 'Apex Racing Emerald',
  },
  {
    name: 'Stealth Carbon Gold',
    primaryColor: '#18181b',
    secondaryColor: '#d97706',
    accentColor: '#fbbf24',
    haloColor: '#09090b',
    sponsorName: 'TAG HEUER',
    teamName: 'Apex Golden Black',
  },
];

const OFFICIAL_SPONSORS = [
  'ORACLE',
  'HONDA HRC',
  'MOBIL 1',
  'TAG HEUER',
  'SANTANDER',
  'PIRELLI',
  'PETRONAS',
  'SHELL',
  'SPARCO',
];

export const CareerStudioModal: React.FC<CareerStudioModalProps> = ({
  isOpen,
  onClose,
  currentLivery,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<'pilot' | 'livery' | 'sponsors'>('pilot');
  const [livery, setLivery] = useState<CustomLiverySettings>({ ...currentLivery });
  const [hasSavedNotice, setHasSavedNotice] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    playUiClick();
    saveLivery(livery);
    onSave(livery);
    setHasSavedNotice(true);
    setTimeout(() => {
      setHasSavedNotice(false);
      onClose();
    }, 400);
  };

  const handleApplyPreset = (preset: LiveryPreset) => {
    playUiClick();
    setLivery((prev) => ({
      ...prev,
      primaryColor: preset.primaryColor,
      secondaryColor: preset.secondaryColor,
      accentColor: preset.accentColor,
      haloColor: preset.haloColor,
      sponsorName: preset.sponsorName,
      teamName: prev.teamName.includes('Oracle') || prev.teamName.includes('Scuderia') ? preset.teamName : prev.teamName,
    }));
  };

  const handleResetDefaults = () => {
    playUiClick();
    setLivery({ ...DEFAULT_LIVERY_SETTINGS });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[90vh] bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-neutral-100">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between bg-neutral-950/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-widest font-['Chakra_Petch']">
                <span>APEX LIVERY STUDIO</span>
                <span className="text-neutral-600">·</span>
                <span className="text-neutral-400">TALLER DE ESCUDERÍA</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white font-['Chakra_Petch'] uppercase">
                Personalización de Piloto, Monoplaza y Colores
              </h2>
            </div>
          </div>

          <button
            onClick={() => {
              playUiClick();
              onClose();
            }}
            className="w-9 h-9 rounded-lg bg-neutral-800 hover:bg-neutral-700 flex items-center justify-center text-neutral-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Studio Tabs */}
        <div className="flex border-b border-neutral-800 bg-neutral-950/40 px-6 pt-2 gap-2">
          <button
            onClick={() => {
              playUiClick();
              setActiveTab('pilot');
            }}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold tracking-wide border-b-2 transition-colors cursor-pointer ${
              activeTab === 'pilot'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <User className="w-4 h-4" />
            <span>1. Piloto y Escudería</span>
          </button>

          <button
            onClick={() => {
              playUiClick();
              setActiveTab('livery');
            }}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold tracking-wide border-b-2 transition-colors cursor-pointer ${
              activeTab === 'livery'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>2. Decoración y Colores</span>
          </button>

          <button
            onClick={() => {
              playUiClick();
              setActiveTab('sponsors');
            }}
            className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold tracking-wide border-b-2 transition-colors cursor-pointer ${
              activeTab === 'sponsors'
                ? 'border-amber-400 text-amber-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>3. Patrocinadores Técnicos</span>
          </button>
        </div>

        {/* Modal Body - Tab Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: PILOT & TEAM */}
          {activeTab === 'pilot' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Driver Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Nombre Completo del Piloto
                  </label>
                  <input
                    type="text"
                    value={livery.driverName}
                    onChange={(e) => setLivery({ ...livery, driverName: e.target.value })}
                    maxLength={24}
                    placeholder="Ej. Max Verstappen"
                    className="w-full px-4 py-2.5 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-medium focus:border-amber-400 focus:outline-none transition-colors"
                  />
                  <p className="text-[11px] text-neutral-400">
                    Aparecerá en los rótulos televisivos de carrera, tabla de tiempos y alerón.
                  </p>
                </div>

                {/* Driver 3-Letter Code */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Código Oficial de 3 Letras
                  </label>
                  <input
                    type="text"
                    value={livery.driverCode}
                    onChange={(e) =>
                      setLivery({
                        ...livery,
                        driverCode: e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3),
                      })
                    }
                    maxLength={3}
                    placeholder="VER"
                    className="w-full px-4 py-2.5 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-mono font-bold tracking-widest uppercase focus:border-amber-400 focus:outline-none transition-colors"
                  />
                  <p className="text-[11px] text-neutral-400">
                    Siglas FIA para la torre de posiciones (ej. VER, ALO, LEC, HAM).
                  </p>
                </div>

                {/* Driver Number */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Número de Dorsal
                  </label>
                  <input
                    type="text"
                    value={livery.driverNumber}
                    onChange={(e) =>
                      setLivery({
                        ...livery,
                        driverNumber: e.target.value.replace(/[^0-9]/g, '').slice(0, 2),
                      })
                    }
                    maxLength={2}
                    placeholder="1"
                    className="w-full px-4 py-2.5 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-['Chakra_Petch'] font-black text-lg focus:border-amber-400 focus:outline-none transition-colors"
                  />
                  <p className="text-[11px] text-neutral-400">
                    Dorsal oficial estampado en el morro, aleta dorsal y alerón trasero.
                  </p>
                </div>

                {/* Team Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Nombre de la Escudería
                  </label>
                  <input
                    type="text"
                    value={livery.teamName}
                    onChange={(e) => setLivery({ ...livery, teamName: e.target.value })}
                    maxLength={28}
                    placeholder="Oracle Red Bull Racing"
                    className="w-full px-4 py-2.5 rounded-lg bg-neutral-950 border border-neutral-700 text-white font-medium focus:border-amber-400 focus:outline-none transition-colors"
                  />
                  <p className="text-[11px] text-neutral-400">
                    Nombre oficial del constructor en la presentación televisiva y campeonato.
                  </p>
                </div>
              </div>

              {/* Pilot Card Preview */}
              <div className="p-4 rounded-xl bg-neutral-950/70 border border-neutral-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-lg flex flex-col items-center justify-center font-['Chakra_Petch'] font-black text-2xl border"
                    style={{
                      backgroundColor: livery.primaryColor,
                      borderColor: livery.accentColor,
                      color: livery.accentColor,
                    }}
                  >
                    <span className="text-[9px] uppercase opacity-75">DORSAL</span>
                    <span>#{livery.driverNumber || '1'}</span>
                  </div>
                  <div>
                    <div className="text-xs text-amber-400 font-bold uppercase tracking-wider">
                      {livery.driverCode || 'VER'} · {livery.teamName || 'ESCUDERÍA'}
                    </div>
                    <div className="text-xl font-extrabold text-white uppercase font-['Chakra_Petch']">
                      {livery.driverName || 'PILOTO OFICIAL'}
                    </div>
                  </div>
                </div>
                <div className="hidden sm:block text-right">
                  <div className="text-[10px] text-neutral-500 uppercase">Patrocinador Principal</div>
                  <div className="text-sm font-bold text-white tracking-wider">{livery.sponsorName || 'ORACLE'}</div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LIVERY COLORS & PRESETS */}
          {activeTab === 'livery' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Presets Grid */}
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-300 block mb-2.5">
                  Plantillas Rápidas de Competición
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {LIVERY_PRESETS.map((p) => (
                    <button
                      key={p.name}
                      onClick={() => handleApplyPreset(p)}
                      className="p-3 rounded-xl bg-neutral-950 border border-neutral-800 hover:border-amber-400/80 transition-all text-left flex items-center justify-between group cursor-pointer"
                    >
                      <div>
                        <div className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors">
                          {p.name}
                        </div>
                        <div className="text-[10px] text-neutral-500 truncate max-w-[120px]">{p.teamName}</div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <div className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: p.primaryColor }} />
                        <div className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: p.secondaryColor }} />
                        <div className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: p.accentColor }} />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Detailed Color Pickers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Primary Color */}
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Color Primario
                  </div>
                  <div className="text-[11px] text-neutral-500">Chasis, morro y carrocería</div>
                  <div className="flex items-center gap-3 pt-1">
                    <input
                      type="color"
                      value={livery.primaryColor}
                      onChange={(e) => setLivery({ ...livery, primaryColor: e.target.value })}
                      className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={livery.primaryColor}
                      onChange={(e) => setLivery({ ...livery, primaryColor: e.target.value })}
                      className="w-24 px-2 py-1 rounded bg-neutral-900 border border-neutral-700 text-xs font-mono uppercase text-white"
                    />
                  </div>
                </div>

                {/* Secondary Color */}
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Color Secundario
                  </div>
                  <div className="text-[11px] text-neutral-500">Pontones y alerones</div>
                  <div className="flex items-center gap-3 pt-1">
                    <input
                      type="color"
                      value={livery.secondaryColor}
                      onChange={(e) => setLivery({ ...livery, secondaryColor: e.target.value })}
                      className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={livery.secondaryColor}
                      onChange={(e) => setLivery({ ...livery, secondaryColor: e.target.value })}
                      className="w-24 px-2 py-1 rounded bg-neutral-900 border border-neutral-700 text-xs font-mono uppercase text-white"
                    />
                  </div>
                </div>

                {/* Accent Color */}
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Acentos y Franjas
                  </div>
                  <div className="text-[11px] text-neutral-500">Detalles y dorsal</div>
                  <div className="flex items-center gap-3 pt-1">
                    <input
                      type="color"
                      value={livery.accentColor}
                      onChange={(e) => setLivery({ ...livery, accentColor: e.target.value })}
                      className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={livery.accentColor}
                      onChange={(e) => setLivery({ ...livery, accentColor: e.target.value })}
                      className="w-24 px-2 py-1 rounded bg-neutral-900 border border-neutral-700 text-xs font-mono uppercase text-white"
                    />
                  </div>
                </div>

                {/* Halo Color */}
                <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                  <div className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                    Estructura Halo
                  </div>
                  <div className="text-[11px] text-neutral-500">Titanio de cabina</div>
                  <div className="flex items-center gap-3 pt-1">
                    <input
                      type="color"
                      value={livery.haloColor}
                      onChange={(e) => setLivery({ ...livery, haloColor: e.target.value })}
                      className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={livery.haloColor}
                      onChange={(e) => setLivery({ ...livery, haloColor: e.target.value })}
                      className="w-24 px-2 py-1 rounded bg-neutral-900 border border-neutral-700 text-xs font-mono uppercase text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic Livery Swatch Preview Bar */}
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex items-center justify-between">
                <span className="text-xs text-neutral-400 font-semibold uppercase tracking-wider">
                  Muestra Dinámica de Pintura
                </span>
                <div className="flex items-center gap-2">
                  <div className="h-6 w-20 rounded border border-white/20" style={{ backgroundColor: livery.primaryColor }} />
                  <div className="h-6 w-16 rounded border border-white/20" style={{ backgroundColor: livery.secondaryColor }} />
                  <div className="h-6 w-10 rounded border border-white/20" style={{ backgroundColor: livery.accentColor }} />
                  <div className="h-6 w-8 rounded border border-white/20" style={{ backgroundColor: livery.haloColor }} />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SPONSORS */}
          {activeTab === 'sponsors' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-300 block mb-2.5">
                  Patrocinadores Técnicos Oficiales
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {OFFICIAL_SPONSORS.map((sp) => {
                    const isSelected = livery.sponsorName === sp;
                    return (
                      <button
                        key={sp}
                        onClick={() => {
                          playUiClick();
                          setLivery({ ...livery, sponsorName: sp });
                        }}
                        className={`p-4 rounded-xl border text-center transition-all cursor-pointer font-['Chakra_Petch'] font-bold text-sm tracking-widest uppercase ${
                          isSelected
                            ? 'bg-amber-500/15 border-amber-400 text-amber-400 shadow-md'
                            : 'bg-neutral-950 border-neutral-800 text-neutral-300 hover:border-neutral-700'
                        }`}
                      >
                        {sp}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Sponsor Input */}
              <div className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-300">
                  O escribe un Patrocinador Personalizado
                </label>
                <input
                  type="text"
                  value={livery.sponsorName}
                  onChange={(e) => setLivery({ ...livery, sponsorName: e.target.value.toUpperCase() })}
                  maxLength={18}
                  placeholder="NOMBRE PATROCINADOR"
                  className="w-full px-4 py-2.5 rounded-lg bg-neutral-900 border border-neutral-700 text-white font-mono font-bold tracking-wider uppercase focus:border-amber-400 focus:outline-none transition-colors"
                />
                <p className="text-[11px] text-neutral-500">
                  Se estampará en el alerón trasero, flaps delanteros y placas laterales.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-neutral-800 bg-neutral-950/70 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={handleResetDefaults}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Restablecer Fábrica</span>
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                playUiClick();
                onClose();
              }}
              className="px-4 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs uppercase tracking-wider transition-all shadow-lg active:scale-95 cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Guardar y Aplicar al Coche</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
