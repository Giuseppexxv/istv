import React, { useRef } from 'react';
import { Globe, ChevronLeft, ChevronRight, Flame } from 'lucide-react';

export interface ProviderConfig {
  id: string;
  name: string;
  shortName: string;
  logoUrl?: string;
  isGlobal?: boolean;
  movieCatalogId: string;
  seriesCatalogId: string;
  movieSubtitle: string;
  seriesSubtitle: string;
  accentColor: string;
  badgeGlow: string;
  activeClass: string;
}

export const STREAMING_PROVIDERS: ProviderConfig[] = [
  {
    id: 'global',
    name: 'Globale',
    shortName: 'Globale',
    isGlobal: true,
    movieCatalogId: 'popular-movie-global',
    seriesCatalogId: 'popular-series-global',
    movieSubtitle: 'I 10 film più popolari e visti al mondo oggi',
    seriesSubtitle: 'Le 10 serie TV più popolari e viste al mondo oggi',
    accentColor: '#f59e0b',
    badgeGlow: 'rgba(245, 158, 11, 0.4)',
    activeClass: 'border-amber-400/90 bg-amber-500/25 text-amber-300 shadow-[0_0_22px_rgba(245,158,11,0.4)]',
  },
  {
    id: 'netflix',
    name: 'Netflix',
    shortName: 'Netflix',
    logoUrl: '/providers/netflix.svg',
    movieCatalogId: 'netflix-movies-italy',
    seriesCatalogId: 'netflix-series-italy',
    movieSubtitle: 'I 10 film più visti su Netflix in Italia oggi',
    seriesSubtitle: 'Le 10 serie TV più viste su Netflix in Italia oggi',
    accentColor: '#e50914',
    badgeGlow: 'rgba(229, 9, 20, 0.45)',
    activeClass: 'border-red-500/90 bg-red-600/25 text-white shadow-[0_0_22px_rgba(229,9,20,0.45)]',
  },
  {
    id: 'prime',
    name: 'Prime Video',
    shortName: 'Prime Video',
    logoUrl: '/providers/prime.svg',
    movieCatalogId: 'amazon-prime-movies-italy',
    seriesCatalogId: 'amazon-prime-series-italy',
    movieSubtitle: 'I 10 film più visti su Prime Video in Italia oggi',
    seriesSubtitle: 'Le 10 serie TV più viste su Prime Video in Italia oggi',
    accentColor: '#00a8e1',
    badgeGlow: 'rgba(0, 168, 225, 0.4)',
    activeClass: 'border-sky-400/90 bg-sky-500/25 text-white shadow-[0_0_22px_rgba(0,168,225,0.4)]',
  },
  {
    id: 'disney',
    name: 'Disney+',
    shortName: 'Disney+',
    logoUrl: '/providers/disney.svg',
    movieCatalogId: 'disney-movies-italy',
    seriesCatalogId: 'disney-series-italy',
    movieSubtitle: 'I 10 film più visti su Disney+ in Italia oggi',
    seriesSubtitle: 'Le 10 serie TV più viste su Disney+ in Italia oggi',
    accentColor: '#38bdf8',
    badgeGlow: 'rgba(56, 189, 248, 0.4)',
    activeClass: 'border-cyan-400/90 bg-cyan-600/25 text-white shadow-[0_0_22px_rgba(56,189,248,0.4)]',
  },
  {
    id: 'apple',
    name: 'Apple TV+',
    shortName: 'Apple TV+',
    logoUrl: '/providers/apple.svg',
    movieCatalogId: 'apple-tv-movies-italy',
    seriesCatalogId: 'apple-tv-series-italy',
    movieSubtitle: 'I 10 film più visti su Apple TV+ in Italia oggi',
    seriesSubtitle: 'Le 10 serie TV più viste su Apple TV+ in Italia oggi',
    accentColor: '#ffffff',
    badgeGlow: 'rgba(255, 255, 255, 0.35)',
    activeClass: 'border-white/90 bg-white/25 text-white shadow-[0_0_22px_rgba(255,255,255,0.35)]',
  },
  {
    id: 'now',
    name: 'NOW (Sky)',
    shortName: 'NOW',
    logoUrl: '/providers/now.svg',
    movieCatalogId: 'now-movies-italy',
    seriesCatalogId: 'now-series-italy',
    movieSubtitle: 'I 10 film più visti su NOW in Italia oggi',
    seriesSubtitle: 'Le 10 serie TV più viste su NOW in Italia oggi',
    accentColor: '#10b981',
    badgeGlow: 'rgba(16, 185, 129, 0.4)',
    activeClass: 'border-emerald-400/90 bg-emerald-500/25 text-white shadow-[0_0_22px_rgba(16,185,129,0.4)]',
  },
  {
    id: 'paramount',
    name: 'Paramount+',
    shortName: 'Paramount+',
    logoUrl: '/providers/paramount.svg',
    movieCatalogId: 'paramount-plus-movies-italy',
    seriesCatalogId: 'paramount-plus-series-italy',
    movieSubtitle: 'I 10 film più visti su Paramount+ in Italia oggi',
    seriesSubtitle: 'Le 10 serie TV più viste su Paramount+ in Italia oggi',
    accentColor: '#60a5fa',
    badgeGlow: 'rgba(96, 165, 250, 0.4)',
    activeClass: 'border-blue-400/90 bg-blue-600/25 text-white shadow-[0_0_22px_rgba(96,165,250,0.4)]',
  },
  {
    id: 'max',
    name: 'Max (HBO)',
    shortName: 'Max',
    logoUrl: '/providers/max.svg',
    movieCatalogId: 'hbo-max-movies-italy',
    seriesCatalogId: 'hbo-max-series-italy',
    movieSubtitle: 'I 10 film più visti su HBO Max oggi',
    seriesSubtitle: 'Le 10 serie TV più viste su HBO Max oggi',
    accentColor: '#a855f7',
    badgeGlow: 'rgba(168, 85, 247, 0.4)',
    activeClass: 'border-purple-400/90 bg-purple-600/25 text-white shadow-[0_0_22px_rgba(168,85,247,0.4)]',
  },
];

interface ProviderSelectorProps {
  selectedProvider: string;
  onSelectProvider: (providerId: string) => void;
  title?: string;
  subtitle?: string;
}

export const ProviderSelector: React.FC<ProviderSelectorProps> = ({
  selectedProvider,
  onSelectProvider,
  title = 'Top 10 Ufficiali per Piattaforma',
  subtitle = 'Seleziona un provider per esplorare le classifiche ufficiali di oggi',
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -260, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 260, behavior: 'smooth' });
    }
  };

  const currentProvider =
    STREAMING_PROVIDERS.find((p) => p.id === selectedProvider) || STREAMING_PROVIDERS[0];

  return (
    <div className="space-y-3.5">
      {/* Header with Title and Current Provider Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-rose-500 fill-rose-500 animate-pulse" />
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2 font-cinematic">
              <span>{title}</span>
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">{subtitle}</p>
        </div>

        {/* Selected Provider Indicator Badge */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="text-xs text-slate-400 font-medium">Classifica attiva:</span>
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold border transition-all shadow-md ${
              currentProvider.isGlobal
                ? 'liquid-glass-transparent border-amber-400/50 text-amber-300'
                : 'liquid-glass-transparent border-white/30 text-white'
            }`}
          >
            {currentProvider.isGlobal ? (
              <Globe className="w-3.5 h-3.5 text-amber-400 animate-spin-slow" />
            ) : currentProvider.logoUrl ? (
              <img
                src={currentProvider.logoUrl}
                alt={currentProvider.name}
                className="h-3.5 max-w-[70px] w-auto object-contain filter drop-shadow-sm"
              />
            ) : null}
            <span>{currentProvider.shortName}</span>
          </div>
        </div>
      </div>

      {/* Main Liquid Glass Pill Container */}
      <div className="relative group/pill">
        {/* Left Scroll Button */}
        <button
          type="button"
          onClick={scrollLeft}
          className="absolute -left-2.5 top-1/2 -translate-y-1/2 z-30 w-8 h-8 rounded-full liquid-glass-elevated border border-white/30 text-white flex items-center justify-center opacity-0 group-hover/pill:opacity-100 transition-opacity duration-200 hover:scale-110 active:scale-95 shadow-xl cursor-pointer hidden sm:flex"
          title="Scorri indietro"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {/* Scrolling Pills Bar */}
        <div
          ref={scrollRef}
          className="p-1.5 sm:p-2 rounded-2xl sm:rounded-full liquid-glass-elevated border border-white/20 shadow-[0_12px_40px_rgba(0,0,0,0.85)] flex items-center gap-2 sm:gap-2.5 overflow-x-auto scrollbar-none select-none scroll-smooth"
        >
          {STREAMING_PROVIDERS.map((provider) => {
            const isSelected = provider.id === selectedProvider;

            return (
              <button
                key={provider.id}
                type="button"
                onClick={() => onSelectProvider(provider.id)}
                className={`relative flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl sm:rounded-full transition-all duration-300 flex-shrink-0 cursor-pointer text-xs font-bold border ${
                  isSelected
                    ? `${provider.activeClass} scale-102`
                    : 'liquid-glass-transparent border-white/10 text-slate-300 hover:text-white hover:border-white/30 hover:bg-white/10 hover:scale-102'
                }`}
                title={`Visualizza Top 10 ${provider.name}`}
              >
                {provider.isGlobal ? (
                  <>
                    <Globe
                      className={`w-4 h-4 transition-transform ${
                        isSelected ? 'text-amber-400 rotate-12 scale-110' : 'text-slate-400'
                      }`}
                    />
                    <span className="whitespace-nowrap tracking-wide text-xs">
                      Top 10 Globale
                    </span>
                  </>
                ) : (
                  <>
                    <img
                      src={provider.logoUrl}
                      alt={provider.name}
                      className={`h-4 sm:h-5 max-w-[85px] sm:max-w-[105px] w-auto object-contain transition-all duration-200 filter drop-shadow-sm ${
                        isSelected
                          ? 'brightness-110 contrast-110 scale-105'
                          : 'opacity-85 hover:opacity-100'
                      }`}
                      loading="eager"
                    />
                  </>
                )}

                {/* Subtle illuminated dot indicator */}
                {isSelected && (
                  <span
                    className="w-1.5 h-1.5 rounded-full ml-1 animate-pulse"
                    style={{ backgroundColor: provider.accentColor }}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Right Scroll Button */}
        <button
          type="button"
          onClick={scrollRight}
          className="absolute -right-2.5 top-1/2 -translate-y-1/2 z-30 w-8 h-8 rounded-full liquid-glass-elevated border border-white/30 text-white flex items-center justify-center opacity-0 group-hover/pill:opacity-100 transition-opacity duration-200 hover:scale-110 active:scale-95 shadow-xl cursor-pointer hidden sm:flex"
          title="Scorri avanti"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
