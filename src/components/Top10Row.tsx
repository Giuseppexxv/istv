import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { StremioMetaPreview } from '../types/stremio';
import { NetflixTop10Card } from './NetflixTop10Card';
import { Top10MovieLogo, Top10SeriesLogo } from './Top10HeaderLogos';
import { ProviderDropdownPill } from './ProviderDropdownPill';
import { STREAMING_PROVIDERS } from './ProviderSelector';
import { filterReleasedTopItems } from '../utils/releaseFilter';

interface Top10RowProps {
  type: 'movie' | 'series';
  items: StremioMetaPreview[];
  selectedProvider: string;
  onSelectProvider: (providerId: string) => void;
  loading?: boolean;
  onSelectMedia: (item: StremioMetaPreview) => void;
  onQuickPlay: (item: StremioMetaPreview) => void;
}

export const Top10Row: React.FC<Top10RowProps> = React.memo(({
  type,
  items,
  selectedProvider,
  onSelectProvider,
  loading = false,
  onSelectMedia,
  onQuickPlay,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const distance = 520;
      rowRef.current.scrollBy({
        left: direction === 'left' ? -distance : distance,
        behavior: 'smooth',
      });
    }
  };

  // 1. Rigorous release date filter: ONLY titles already released by today
  const releasedItems = React.useMemo(() => {
    return filterReleasedTopItems(items, 10);
  }, [items]);

  const providerConfig =
    STREAMING_PROVIDERS.find((p) => p.id === selectedProvider) || STREAMING_PROVIDERS[0];

  const title = type === 'movie' ? 'Top 10 film' : 'Top 10 serie TV';

  return (
    <div className="space-y-3 relative group/top10">
      {/* ================= ROW HEADER ================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Dedicated Coherent Logo + Clean Title (NO yellow pill badge) */}
        <div className="flex items-center gap-3">
          {type === 'movie' ? <Top10MovieLogo /> : <Top10SeriesLogo />}

          <div>
            <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight font-cinematic flex items-center gap-2">
              <span>{title}</span>
            </h3>
          </div>
        </div>

        {/* Right: Provider Dropdown Pill + Navigation Scroll Arrows */}
        <div className="flex items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto">
          {/* Provider Dropdown Pill with All Uniform Provider Logos */}
          <ProviderDropdownPill
            selectedProvider={selectedProvider}
            onSelectProvider={onSelectProvider}
            type={type}
          />

          {/* Left / Right Scroll Controls */}
          <div className="flex items-center gap-1 p-1 rounded-full liquid-glass-transparent border border-white/20 shadow-md">
            <button
              type="button"
              onClick={() => scroll('left')}
              className="w-9 h-9 sm:w-8 sm:h-8 rounded-full text-white/90 hover:text-white hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95"
              title="Scorri indietro"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-white/20" />
            <button
              type="button"
              onClick={() => scroll('right')}
              className="w-9 h-9 sm:w-8 sm:h-8 rounded-full text-white/90 hover:text-white hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95"
              title="Scorri avanti"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ================= NETFLIX-STYLE MONUMENTAL CAROUSEL ================= */}
      <div className="relative">
        <div
          ref={rowRef}
          className="flex items-end gap-3 sm:gap-6 md:gap-8 overflow-x-auto pb-6 pt-7 sm:pt-8 scroll-smooth scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 -mt-3"
        >
          {releasedItems.length === 0 && loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-end gap-2 flex-shrink-0 animate-pulse py-2">
                <div className="w-16 sm:w-20 h-52 sm:h-64 rounded-xl bg-white/[0.04]" />
                <div className="w-36 sm:w-44 aspect-[2/3] rounded-2xl liquid-glass border border-white/10 bg-white/[0.03]" />
              </div>
            ))
          ) : releasedItems.length === 0 ? (
            <div className="py-8 px-4 text-center text-xs text-slate-400 w-full liquid-glass-transparent rounded-2xl border border-white/10">
              Nessun titolo disponibile al momento per questo provider.
            </div>
          ) : (
            releasedItems.map((item, index) => (
              <div key={`${item.id}-${index}`} className="flex-shrink-0 pt-1 pb-1">
                <NetflixTop10Card
                  item={item}
                  rank={index + 1}
                  categoryType={type}
                  onSelect={onSelectMedia}
                  onQuickPlay={onQuickPlay}
                />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
});

Top10Row.displayName = 'Top10Row';
