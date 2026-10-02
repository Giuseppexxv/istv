import React, { useState } from 'react';
import { Play, Star, Plus, Check, Film, Tv, Crown, Medal, Flame, X } from 'lucide-react';
import { StremioMetaPreview } from '../types/stremio';
import { stremioService } from '../services/stremioService';
import { getReleaseYear } from '../utils/formatters';
import { optimizeImageUrl } from '../utils/imageOptimizer';

interface MediaCardProps {
  item: StremioMetaPreview;
  rank?: number;
  onSelect: (item: StremioMetaPreview) => void;
  onQuickPlay: (item: StremioMetaPreview) => void;
  onRemove?: (item: StremioMetaPreview) => void;
}

export const MediaCard: React.FC<MediaCardProps> = React.memo(({ item, rank, onSelect, onQuickPlay, onRemove }) => {
  const [fallbackLevel, setFallbackLevel] = useState(0);
  const [inLibrary, setInLibrary] = useState(() => stremioService.isInLibrary(item.id));

  React.useEffect(() => {
    const currentId = String(item.id || '').trim();
    setInLibrary(stremioService.isInLibrary(currentId));

    const handleLibraryUpdate = (e: Event) => {
      const customEv = e as CustomEvent;
      // Precision update: only re-render the exact card that changed
      if (customEv.detail && typeof customEv.detail.id === 'string') {
        if (customEv.detail.id === currentId) {
          setInLibrary(Boolean(customEv.detail.inLibrary));
        }
        return;
      }
      // Fallback for global clear only
      setInLibrary(stremioService.isInLibrary(currentId));
    };

    window.addEventListener('stremio_library_changed', handleLibraryUpdate);
    return () => {
      window.removeEventListener('stremio_library_changed', handleLibraryUpdate);
    };
  }, [item.id]);

  const handleLibraryToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    const state = stremioService.toggleLibraryItem(item);
    setInLibrary(state);
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(item);
  };

  const rawPoster = item.poster;
  const imdbId = item.id?.startsWith('tt') ? item.id : null;

  // Multi-tier resilient fallback: primary -> metahub medium -> metahub small -> unsplash
  const posterSrc = React.useMemo(() => {
    if (fallbackLevel === 0) {
      if (rawPoster && !rawPoster.includes('unsplash')) {
        return optimizeImageUrl(rawPoster, 'poster') || rawPoster;
      }
      if (imdbId) {
        return `https://images.metahub.space/poster/medium/${imdbId}/img`;
      }
    }
    if (fallbackLevel <= 1 && imdbId) {
      return `https://images.metahub.space/poster/medium/${imdbId}/img`;
    }
    if (fallbackLevel <= 2 && imdbId) {
      return `https://images.metahub.space/poster/small/${imdbId}/img`;
    }
    if (rawPoster) {
      return rawPoster;
    }
    return 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=480&q=80';
  }, [fallbackLevel, rawPoster, imdbId]);

  const handleImgError = () => {
    if (fallbackLevel < 3) {
      setFallbackLevel((prev) => prev + 1);
    }
  };

  const releaseYear = getReleaseYear(item.releaseInfo);
  const isMovie = item.type === 'movie';
  const typeLabel = isMovie ? 'Film' : 'Serie TV';

  const effectiveGenres = item.genres;
  const genreLabel =
    effectiveGenres && effectiveGenres.length > 0
      ? effectiveGenres.slice(0, 2).join(' • ')
      : (isMovie ? 'Cinema' : 'Serie TV');

  const effectiveRating = item.imdbRating;
  const displayRating =
    effectiveRating &&
    effectiveRating !== 'N/A' &&
    effectiveRating !== '' &&
    effectiveRating !== '0'
      ? typeof effectiveRating === 'number'
        ? effectiveRating.toFixed(1)
        : String(effectiveRating)
      : null;

  return (
    <div
      id={`media-card-${item.id}`}
      onClick={() => onSelect(item)}
      className={`group relative flex flex-col rounded-2xl overflow-hidden cursor-pointer select-none transition-all duration-200 hover:-translate-y-1.5 bg-[#0e0e18] carousel-card-contain ${
        isMovie
          ? 'border border-rose-500/20 hover:border-rose-500/60 hover:shadow-[0_12px_28px_rgba(225,29,72,0.25)]'
          : 'border border-purple-500/20 hover:border-purple-500/60 hover:shadow-[0_12px_28px_rgba(168,85,247,0.25)]'
      }`}
    >
      {/* 2:3 Cinematic Poster Image Container */}
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-[#0a0a12]">
        <img
          src={posterSrc}
          alt={item.name}
          onError={handleImgError}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover transition-transform duration-300 ease-out group-hover:scale-105 filter brightness-95 group-hover:brightness-105"
          loading="lazy"
          decoding="async"
        />

        {/* Top Scrim Gradient */}
        <div className="absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-black/85 via-black/35 to-transparent pointer-events-none z-10" />

        {/* Bottom Ambient Dark Gradient Scrim */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0e0e18] via-[#0e0e18]/80 to-transparent pointer-events-none z-10" />

        {/* Top Header Bar: Type Badge, Rank, Rating and Remove Pallino */}
        <div className="absolute top-2.5 inset-x-2.5 z-30 flex items-center justify-between pointer-events-none">
          {/* Left: Type Badge (Serie TV / Film) & Rating (Valutazione) aligned side-by-side */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Pillola Tipo Film / Serie con contrasto nitido e zero carico GPU */}
            <div className="flex items-center gap-1.5 text-[10px] font-black px-2 py-0.5 rounded-lg bg-[#0e0e18]/90 border border-white/20 text-white shadow-md">
              {isMovie ? (
                <Film className="w-3 h-3 text-rose-400" />
              ) : (
                <Tv className="w-3 h-3 text-purple-400" />
              )}
              <span className="font-black tracking-wide text-white">{typeLabel}</span>
            </div>

            {/* Rank Badge (#1, #2, #3, ...) presente nelle altre mini-schede */}
            {rank !== undefined && rank <= 10 && (
              <div>
                {rank === 1 ? (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-950/85 border border-amber-400/80 shadow-[0_4px_14px_rgba(245,158,11,0.4)]">
                    <Crown className="w-3 h-3 text-amber-400 fill-amber-400 animate-pulse" />
                    <span className="text-[10px] font-black tracking-tight text-white font-cinematic">#1</span>
                  </div>
                ) : rank === 2 ? (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900/90 border border-slate-300/80 shadow-[0_4px_14px_rgba(255,255,255,0.3)]">
                    <Medal className="w-3 h-3 text-slate-200 fill-slate-200" />
                    <span className="text-[10px] font-black tracking-tight text-white font-cinematic">#2</span>
                  </div>
                ) : rank === 3 ? (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-950/85 border border-orange-500/80 shadow-[0_4px_14px_rgba(249,115,22,0.35)]">
                    <Medal className="w-3 h-3 text-amber-400 fill-amber-400" />
                    <span className="text-[10px] font-black tracking-tight text-white font-cinematic">#3</span>
                  </div>
                ) : (
                  <div
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[#0e0e18]/90 border ${
                      isMovie
                        ? 'border-rose-500/70 shadow-[0_4px_14px_rgba(225,29,72,0.3)]'
                        : 'border-purple-500/70 shadow-[0_4px_14px_rgba(168,85,247,0.3)]'
                    }`}
                  >
                    <Flame
                      className={`w-3 h-3 ${
                        isMovie ? 'text-rose-400 fill-rose-400' : 'text-purple-400 fill-purple-400'
                      }`}
                    />
                    <span className="text-[10px] font-black tracking-tight text-white font-cinematic">#{rank}</span>
                  </div>
                )}
              </div>
            )}

            {/* Nei salvati: badge sTV allineato con la valutazione (Rating) */}
            {onRemove && displayRating && (
              <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-black text-amber-300 px-2 py-0.5 rounded-lg bg-black/85 border border-amber-400/40 shadow-md">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span className="font-black">{displayRating}</span>
              </div>
            )}
          </div>

          {/* Right: Pallino per cancellare nei salvati, oppure Valutazione nelle sezioni standard */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {!onRemove && displayRating && (
              <div className="flex items-center gap-1 text-[11px] font-black text-amber-300 px-2.5 py-0.5 rounded-lg bg-black/85 border border-amber-400/40 shadow-md pointer-events-none">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                <span className="font-black">{displayRating}</span>
              </div>
            )}

            {onRemove && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  onRemove(item);
                }}
                className="pointer-events-auto w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full bg-black/85 hover:bg-rose-600 text-white/90 hover:text-white border border-white/30 hover:border-rose-400 flex items-center justify-center transition-all duration-200 cursor-pointer shadow-lg active:scale-90"
                title="Rimuovi dalla libreria"
                aria-label="Rimuovi dalla libreria"
              >
                <X className="w-3.5 h-3.5 stroke-[2.5]" />
              </button>
            )}
          </div>
        </div>

        {/* Quick Play & Action Hover Overlay */}
        <div className="absolute inset-0 z-30 bg-black/55 p-3 flex flex-col justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none group-hover:pointer-events-auto">
          {/* Top spacer */}
          <div className="h-6" />

          {/* Center Play Button with library toggle comfortably positioned alongside */}
          <div className="flex flex-col items-center justify-center gap-2">
            <button
              type="button"
              onClick={handlePlayClick}
              className={`w-12 h-12 rounded-full text-white flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all cursor-pointer group/btn ${
                isMovie
                  ? 'bg-gradient-to-r from-red-600 to-rose-600 shadow-red-600/50'
                  : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 shadow-purple-600/50'
              }`}
              title={isMovie ? 'Guarda Ora' : 'Guarda Serie TV'}
            >
              <Play className="w-5 h-5 fill-current ml-0.5 group-hover/btn:scale-110 transition-transform" />
            </button>

            {/* Quick add/remove button placed nicely without overlapping text */}
            <button
              type="button"
              onClick={handleLibraryToggle}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer border shadow-md active:scale-95 ${
                inLibrary
                  ? 'bg-emerald-500/30 text-emerald-300 border-emerald-500/50'
                  : 'liquid-glass-transparent text-white border-white/30 hover:bg-white/20'
              }`}
              title={inLibrary ? 'Rimuovi dalla Libreria' : 'Aggiungi alla Libreria'}
            >
              {inLibrary ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              <span>{inLibrary ? 'Salvato' : 'Libreria'}</span>
            </button>
          </div>

          {/* Bottom spacer */}
          <div className="h-4 pointer-events-none" />
        </div>
      </div>

      {/* Card Footer: Title & Info */}
      <div className="p-2.5 sm:p-3 flex flex-col flex-1 justify-between bg-[#0e0e18] relative z-20">
        <div>
          <h4
            className="text-xs sm:text-sm font-bold text-white line-clamp-1 leading-snug group-hover:text-red-400 transition-colors"
            title={item.name}
          >
            {item.name}
          </h4>

          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1 font-medium">
            {releaseYear && <span>{releaseYear}</span>}
            {releaseYear && <span>•</span>}
            <span className="line-clamp-1 text-slate-400">{genreLabel}</span>
          </div>
        </div>
      </div>
    </div>
  );
});

MediaCard.displayName = 'MediaCard';
