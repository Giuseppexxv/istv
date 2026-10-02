import React, { useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { StremioMetaPreview, StremioMetaDetail, StremioStream, StremioVideo } from '../types/stremio';
import { MediaCard } from './MediaCard';
import { GenreDefinition, buildSubcategoryRows } from '../services/genreSubcategoryService';

interface CategoryDetailViewProps {
  type: 'movie' | 'series';
  genreDef: GenreDefinition;
  items: StremioMetaPreview[];
  loading: boolean;
  onSelectMedia: (item: StremioMetaPreview) => void;
  onPlayStream: (media: StremioMetaDetail, stream?: StremioStream, video?: StremioVideo) => void;
  onBackToAll?: () => void;
}

export const CategoryDetailView: React.FC<CategoryDetailViewProps> = ({
  type,
  genreDef,
  items,
  loading,
  onSelectMedia,
  onPlayStream,
}) => {
  // Build 6 thematic rows for the selected genre
  const thematicRows = useMemo(() => {
    return buildSubcategoryRows(genreDef, items);
  }, [genreDef, items]);

  const handleQuickPlay = (m: StremioMetaPreview) => {
    onSelectMedia(m);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Loading state */}
      {loading && items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-3">
          <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
          <span className="text-sm font-medium text-slate-400">
            Caricamento titoli {genreDef.name}...
          </span>
        </div>
      ) : (
        /* Thematic Subcategories Rows */
        <div className="space-y-10">
          {thematicRows.map((row) => (
            <SubcategoryShelfRow
              key={row.id}
              title={row.title}
              items={row.items}
              type={type}
              onSelect={onSelectMedia}
              onQuickPlay={handleQuickPlay}
            />
          ))}

          {thematicRows.length === 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5 pt-4 pb-6">
              {items.map((item, idx) => (
                <MediaCard
                  key={`${item.id}-${idx}`}
                  item={item}
                  onSelect={onSelectMedia}
                  onQuickPlay={handleQuickPlay}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Clean Subcategory Shelf Row with Thematic Icon Badge
interface SubcategoryShelfRowProps {
  title: string;
  items: StremioMetaPreview[];
  type?: 'movie' | 'series';
  onSelect: (item: StremioMetaPreview) => void;
  onQuickPlay: (item: StremioMetaPreview) => void;
}

const SubcategoryShelfRow: React.FC<SubcategoryShelfRowProps> = ({
  title,
  items,
  type = 'movie',
  onSelect,
  onQuickPlay,
}) => {
  const rowRef = React.useRef<HTMLDivElement>(null);

  const scroll = (dir: 'left' | 'right') => {
    if (!rowRef.current) return;
    const distance = 460;
    rowRef.current.scrollBy({
      left: dir === 'left' ? -distance : distance,
      behavior: 'smooth',
    });
  };

  return (
    <div className="space-y-3 relative group/row">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center">
          <h3 className="text-lg sm:text-xl font-black text-white tracking-tight">
            {title}
          </h3>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-full liquid-glass border border-white/20 shadow-md">
          <button
            type="button"
            onClick={() => scroll('left')}
            className="w-7 h-7 rounded-full text-slate-300 hover:text-white hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer"
            title="Scorri a sinistra"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="w-px h-3 bg-white/20" />
          <button
            type="button"
            onClick={() => scroll('right')}
            className="w-7 h-7 rounded-full text-slate-300 hover:text-white hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer"
            title="Scorri a destra"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="relative">
        <div
          ref={rowRef}
          className="flex gap-4 overflow-x-auto pb-4 pt-2 scroll-smooth scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0"
        >
          {items.map((item, idx) => (
            <div key={`${item.id}-${idx}`} className="w-44 sm:w-52 md:w-56 flex-shrink-0">
              <MediaCard
                item={item}
                onSelect={onSelect}
                onQuickPlay={onQuickPlay}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
