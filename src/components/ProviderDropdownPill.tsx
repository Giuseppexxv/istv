import React, { useState, useRef, useEffect } from 'react';
import { Globe, ChevronDown, Check } from 'lucide-react';
import { STREAMING_PROVIDERS, ProviderConfig } from './ProviderSelector';

interface ProviderDropdownPillProps {
  selectedProvider: string;
  onSelectProvider: (providerId: string) => void;
  type?: 'movie' | 'series';
}

export const ProviderDropdownPill: React.FC<ProviderDropdownPillProps> = ({
  selectedProvider,
  onSelectProvider,
  type = 'movie',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const current =
    STREAMING_PROVIDERS.find((p) => p.id === selectedProvider) || STREAMING_PROVIDERS[0];

  const handleSelect = (provider: ProviderConfig) => {
    onSelectProvider(provider.id);
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      {/* Trigger Button: Sleek Liquid Glass Pill */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group relative flex items-center gap-1.5 px-2.5 sm:px-3.5 py-1 sm:py-2 rounded-full transition-all duration-300 cursor-pointer shadow-lg active:scale-95 border ${
          isOpen
            ? 'liquid-glass-elevated border-white/40 shadow-[0_0_20px_rgba(255,255,255,0.2)]'
            : current.isGlobal
            ? 'liquid-glass-transparent border-amber-400/40 text-amber-300 hover:border-amber-400/70 hover:bg-amber-500/10'
            : 'liquid-glass-transparent border-white/20 text-white hover:border-white/40 hover:bg-white/10'
        }`}
        title="Cambia Piattaforma Top 10"
      >
        {/* Glow halo */}
        <div
          className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none blur-sm"
          style={{
            background: current.isGlobal
              ? 'radial-gradient(circle, rgba(245,158,11,0.25) 0%, transparent 70%)'
              : `radial-gradient(circle, ${current.badgeGlow} 0%, transparent 70%)`,
          }}
        />

        {/* Current Provider Icon/Logo Display */}
        <div className="relative z-10 flex items-center gap-1.5">
          {current.isGlobal ? (
            <>
              <Globe className="w-3 h-3 text-amber-400 animate-spin-slow flex-shrink-0" />
              <span className="text-[11px] sm:text-xs font-bold tracking-wide text-amber-300 whitespace-nowrap">
                Globale
              </span>
            </>
          ) : (
            <>
              <div className="h-4 w-14 sm:w-20 flex items-center justify-start flex-shrink-0">
                <img
                  src={current.logoUrl}
                  alt={current.name}
                  className="max-h-3.5 sm:max-h-4.5 max-w-full w-auto object-contain filter drop-shadow-sm brightness-110"
                />
              </div>
              <span className="text-[11px] sm:text-xs font-bold tracking-wide text-white whitespace-nowrap hidden sm:inline">
                {current.shortName}
              </span>
            </>
          )}

          <ChevronDown
            className={`w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-300 transition-transform duration-200 flex-shrink-0 ${
              isOpen ? 'rotate-180 text-white' : 'group-hover:translate-y-0.5'
            }`}
          />
        </div>
      </button>

      {/* Dropdown Menu Container (Opens towards the right on mobile) */}
      {isOpen && (
        <div className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 w-52 sm:w-60 rounded-2xl p-2 z-50 liquid-glass-elevated border border-white/25 shadow-[0_20px_50px_rgba(0,0,0,0.95)] backdrop-blur-3xl animate-in fade-in zoom-in-95 duration-150">
          {/* Header text */}
          <div className="px-2.5 py-1.5 border-b border-white/10">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
              Seleziona Piattaforma
            </span>
          </div>

          {/* List of Streaming Providers */}
          <div className="py-1.5 space-y-1 max-h-80 overflow-y-auto scrollbar-none">
            {STREAMING_PROVIDERS.map((provider) => {
              const isSelected = provider.id === selectedProvider;

              return (
                <button
                  key={provider.id}
                  type="button"
                  onClick={() => handleSelect(provider)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl transition-all duration-200 cursor-pointer text-left border ${
                    isSelected
                      ? 'liquid-glass-elevated border-white/40 bg-white/15 text-white shadow-md'
                      : 'liquid-glass-transparent border-transparent hover:border-white/15 hover:bg-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Standardized uniform logo container */}
                    <div className="w-16 h-5 flex items-center justify-center flex-shrink-0 bg-black/40 rounded-lg p-1 border border-white/10">
                      {provider.isGlobal ? (
                        <div className="flex items-center gap-1">
                          <Globe className="w-3 h-3 text-amber-400" />
                          <span className="text-[9px] font-black tracking-tight text-amber-300">
                            GLOBAL
                          </span>
                        </div>
                      ) : (
                        <img
                          src={provider.logoUrl}
                          alt={provider.name}
                          className="max-h-3.5 max-w-full w-auto object-contain filter drop-shadow-sm brightness-110"
                        />
                      )}
                    </div>

                    {/* Provider Name only */}
                    <span className="text-xs font-bold leading-tight text-white">
                      {provider.name}
                    </span>
                  </div>

                  {/* Selected Indicator */}
                  {isSelected && (
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center shadow-md flex-shrink-0"
                      style={{ backgroundColor: provider.accentColor }}
                    >
                      <Check className="w-2.5 h-2.5 text-white stroke-[3]" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
