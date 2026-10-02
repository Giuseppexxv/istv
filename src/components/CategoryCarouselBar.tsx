import React, { useRef } from 'react';
import {
  Film,
  Tv,
  Smile,
  Flame,
  Rocket,
  Ghost,
  ShieldAlert,
  Clapperboard,
  Search,
  Compass,
  Heart,
  FileText,
  Users,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Layers,
  Zap,
  X,
} from 'lucide-react';
import { GenreDefinition } from '../services/genreSubcategoryService';

interface CategoryCarouselBarProps {
  type: 'movie' | 'series';
  genres: GenreDefinition[];
  selectedGenreName: string;
  onSelectGenre: (name: string) => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Film,
  Tv,
  Smile,
  Flame,
  Rocket,
  Ghost,
  ShieldAlert,
  Clapperboard,
  Search,
  Compass,
  Heart,
  FileText,
  Users,
  Sparkles,
  Layers,
  Zap,
};

export const CategoryCarouselBar: React.FC<CategoryCarouselBarProps> = React.memo(({
  type,
  genres,
  selectedGenreName,
  onSelectGenre,
  searchQuery = '',
  onSearchChange,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 320;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  const isMovie = type === 'movie';

  return (
    <div className="w-full space-y-2.5">
      {/* Category Bar Header with Categoria / Generi on Left and Selector on Far Right */}
      <div className="flex items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isMovie
              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
              : 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
          }`}>
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2 whitespace-nowrap">
              <span>Generi</span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3 ml-auto flex-shrink-0">
          {/* Scroll arrows for the category carousel */}
          <div className="flex items-center gap-1 p-1 rounded-full liquid-glass border border-white/20 shadow-sm flex-shrink-0">
            <button
              type="button"
              onClick={() => scroll('left')}
              className="w-7 h-7 rounded-full text-slate-300 hover:text-white hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer"
              title="Scorri categorie a sinistra"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <div className="w-px h-3 bg-white/20" />
            <button
              type="button"
              onClick={() => scroll('right')}
              className="w-7 h-7 rounded-full text-slate-300 hover:text-white hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer"
              title="Scorri categorie a destra"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Cerca Input on the Far Right */}
          {onSearchChange && (
            <div className="relative flex items-center transition-all duration-300 liquid-glass-transparent rounded-full px-3 py-1.5 border border-white/20 shadow-2xl w-40 sm:w-52 focus-within:ring-2 focus-within:ring-purple-500/50 flex-shrink-0">
              <Search className="w-3.5 h-3.5 text-purple-400 mr-1.5 flex-shrink-0" />
              <input
                type="text"
                placeholder="Cerca..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-transparent text-xs text-white placeholder-slate-400 focus:outline-none font-medium"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearchChange('')}
                  className="text-slate-400 hover:text-white ml-1 p-0.5 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Category Carousel Pills Bar - Clean, no cut-off, no bleeding bottom shadow */}
      <div className="relative py-1">
        <div
          ref={scrollContainerRef}
          className="flex items-center gap-2 overflow-x-auto py-1 px-1 scroll-smooth scrollbar-none"
        >
          {genres.map((g) => {
            const isSelected = selectedGenreName === g.name;
            const Icon = ICON_MAP[g.icon] || (isMovie ? Film : Tv);

            return (
              <button
                key={g.id}
                type="button"
                onClick={() => onSelectGenre(g.name)}
                className={`group flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors duration-150 cursor-pointer flex-shrink-0 select-none ${
                  isSelected
                    ? isMovie
                      ? 'bg-rose-600 text-white font-bold border border-rose-400/60'
                      : 'bg-purple-600 text-white font-bold border border-purple-400/60'
                    : 'liquid-glass text-slate-300 hover:text-white hover:bg-white/15 border border-white/10'
                }`}
              >
                <span className={`p-1 rounded-lg transition-colors ${
                  isSelected
                    ? 'bg-black/25 text-white'
                    : isMovie
                    ? 'bg-rose-500/10 text-rose-300 group-hover:bg-rose-500/20'
                    : 'bg-purple-500/10 text-purple-300 group-hover:bg-purple-500/20'
                }`}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span>{g.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
});
