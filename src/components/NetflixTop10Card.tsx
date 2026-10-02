import React, { useState } from 'react';
import { Play, Star, Plus, Check } from 'lucide-react';
import { StremioMetaPreview } from '../types/stremio';
import { stremioService } from '../services/stremioService';
import { getReleaseYear } from '../utils/formatters';
import { optimizeImageUrl } from '../utils/imageOptimizer';

interface NetflixTop10CardProps {
  item: StremioMetaPreview;
  rank: number; // 1 to 10
  categoryType?: 'movie' | 'series';
  onSelect: (item: StremioMetaPreview) => void;
  onQuickPlay: (item: StremioMetaPreview) => void;
}

export const NetflixTop10Card: React.FC<NetflixTop10CardProps> = React.memo(({
  item,
  rank,
  categoryType,
  onSelect,
  onQuickPlay,
}) => {
  const [fallbackLevel, setFallbackLevel] = useState(0);
  const [inLibrary, setInLibrary] = useState(() => stremioService.isInLibrary(item.id));
  const [isHovered, setIsHovered] = useState(false);

  React.useEffect(() => {
    const currentId = String(item.id || '').trim();
    setInLibrary(stremioService.isInLibrary(currentId));

    const handleLibraryUpdate = (e: Event) => {
      const customEv = e as CustomEvent;
      if (customEv.detail && typeof customEv.detail.id === 'string') {
        if (customEv.detail.id === currentId) {
          setInLibrary(Boolean(customEv.detail.inLibrary));
        }
        return;
      }
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
  const isMovieCategory = categoryType ? categoryType === 'movie' : item.type === 'movie';
  const isMovie = item.type === 'movie';

  const effectiveGenres = item.genres;
  const genreLabel =
    effectiveGenres && effectiveGenres.length > 0
      ? effectiveGenres.slice(0, 2).join(' • ')
      : isMovie
      ? 'Cinema'
      : 'Serie TV';

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

  // Visual styling for the monumental Netflix rank numbers:
  // #1 ORO (Pure 24k Gold)
  // #2 ARGENTO (Pure Liquid Silver / Platinum)
  // #3 BRONZO (Pure Fiery Olympic Bronze)
  // #4-10 Film: Cinema Crimson Red
  // #4-10 Serie: Electric Purple / Violet
  const getRankNumberStyles = (num: number, isFilm: boolean) => {
    if (num === 1) {
      return {
        stops: [
          { offset: '0%', color: '#fff9c4' },
          { offset: '25%', color: '#facc15' },
          { offset: '60%', color: '#f59e0b' },
          { offset: '85%', color: '#b45309' },
          { offset: '100%', color: '#78350f' },
        ],
        glow: 'drop-shadow(0 0 18px rgba(250, 204, 21, 0.75))',
        gradStart: '#2d2006',
        gradMid: '#161003',
        borderColor: 'border-amber-400/80 shadow-[0_12px_35px_rgba(0,0,0,0.85),0_0_20px_rgba(250,204,21,0.3)]',
      };
    }
    if (num === 2) {
      return {
        stops: [
          { offset: '0%', color: '#ffffff' },
          { offset: '25%', color: '#e2e8f0' },
          { offset: '60%', color: '#cbd5e1' },
          { offset: '85%', color: '#94a3b8' },
          { offset: '100%', color: '#475569' },
        ],
        glow: 'drop-shadow(0 0 18px rgba(226, 232, 240, 0.7))',
        gradStart: '#1e2533',
        gradMid: '#0f141f',
        borderColor: 'border-slate-200/80 shadow-[0_12px_35px_rgba(0,0,0,0.85),0_0_20px_rgba(255,255,255,0.3)]',
      };
    }
    if (num === 3) {
      return {
        stops: [
          { offset: '0%', color: '#ffedd5' },
          { offset: '25%', color: '#fb923c' },
          { offset: '60%', color: '#ea580c' },
          { offset: '85%', color: '#c2410c' },
          { offset: '100%', color: '#7c2d12' },
        ],
        glow: 'drop-shadow(0 0 18px rgba(249, 115, 22, 0.7))',
        gradStart: '#2b1307',
        gradMid: '#160a03',
        borderColor: 'border-orange-500/80 shadow-[0_12px_35px_rgba(0,0,0,0.85),0_0_20px_rgba(249,115,22,0.3)]',
      };
    }
    // #4 to #10: Cinema Red for Movies, Electric Purple for Series
    if (isFilm) {
      return {
        stops: [
          { offset: '0%', color: '#ffe4e6' },
          { offset: '25%', color: '#fb7185' },
          { offset: '60%', color: '#f43f5e' },
          { offset: '85%', color: '#e11d48' },
          { offset: '100%', color: '#881337' },
        ],
        glow: 'drop-shadow(0 0 16px rgba(244, 63, 94, 0.6))',
        gradStart: '#280611',
        gradMid: '#140308',
        borderColor: 'border-rose-500/50 shadow-[0_10px_30px_rgba(0,0,0,0.8)]',
      };
    } else {
      return {
        stops: [
          { offset: '0%', color: '#f5d0fe' },
          { offset: '25%', color: '#e879f9' },
          { offset: '60%', color: '#c084fc' },
          { offset: '85%', color: '#9333ea' },
          { offset: '100%', color: '#581c87' },
        ],
        glow: 'drop-shadow(0 0 16px rgba(192, 132, 252, 0.6))',
        gradStart: '#220836',
        gradMid: '#11031b',
        borderColor: 'border-purple-500/50 shadow-[0_10px_30px_rgba(0,0,0,0.8)]',
      };
    }
  };

  const rankStyle = getRankNumberStyles(rank, isMovieCategory);

  // SVG viewBox and text position coordinates to guarantee zero clipping on wide numbers (e.g. 2, 4, 10)
  const isTen = rank === 10;
  const isOne = rank === 1;
  const svgViewBox = isTen ? '0 0 190 220' : isOne ? '0 0 100 220' : '0 0 140 220';
  const textX = isTen ? '95' : isOne ? '50' : '70';
  const fontSize = isTen ? '185px' : '210px';
  const letterSpacing = isTen ? '-10px' : '-4px';

  // Overlap amount: the back (right side) of the number is cleanly cut off and tucked under the poster card
  const getNumberOverlapClass = (num: number) => {
    if (num === 1) return '-mr-5 sm:-mr-8 md:-mr-10';
    if (num === 10) return '-mr-10 sm:-mr-14 md:-mr-18';
    return '-mr-8 sm:-mr-12 md:-mr-15';
  };

  return (
    <div
      className="group relative flex items-end flex-shrink-0 select-none py-2"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ================= MONUMENTAL METALLIC RANK NUMBER (LEFT) ================= */}
      <div
        className={`relative z-10 flex-shrink-0 flex items-end pointer-events-none select-none ${getNumberOverlapClass(
          rank
        )} translate-y-1 sm:translate-y-2 transition-transform duration-200 group-hover:scale-105`}
        style={{ filter: rankStyle.glow }}
      >
        <svg
          viewBox={svgViewBox}
          className="h-52 sm:h-64 md:h-72 w-auto overflow-visible"
        >
          <defs>
            <linearGradient id={`fill-grad-${rank}-${isMovieCategory ? 'm' : 's'}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={rankStyle.gradStart} />
              <stop offset="60%" stopColor={rankStyle.gradMid} />
              <stop offset="100%" stopColor="#040407" />
            </linearGradient>

            <linearGradient id={`stroke-grad-${rank}-${isMovieCategory ? 'm' : 's'}`} x1="0%" y1="0%" x2="0%" y2="100%">
              {rankStyle.stops.map((s, idx) => (
                <stop key={idx} offset={s.offset} stopColor={s.color} />
              ))}
            </linearGradient>
          </defs>

          {/* Majestic, well-proportioned typography with back tucked under card */}
          <text
            x={textX}
            y="185"
            textAnchor="middle"
            fill={`url(#fill-grad-${rank}-${isMovieCategory ? 'm' : 's'})`}
            stroke={`url(#stroke-grad-${rank}-${isMovieCategory ? 'm' : 's'})`}
            strokeWidth="3.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{
              fontFamily: '"Impact", "Bebas Neue", "Arial Black", sans-serif',
              fontSize,
              fontWeight: 900,
              letterSpacing,
            }}
          >
            {rank}
          </text>
        </svg>
      </div>

      {/* ================= POSTER CARD (RIGHT / OVERLAPPING) ================= */}
      <div
        onClick={() => onSelect(item)}
        className={`relative z-20 w-36 sm:w-44 md:w-48 aspect-[2/3] rounded-2xl overflow-hidden cursor-pointer transition-all duration-200 transform-gpu bg-[#0a0a14] border shadow-2xl flex-shrink-0 ${
          isHovered
            ? 'scale-105 -translate-y-2 border-white/70 shadow-[0_20px_45px_rgba(0,0,0,0.95),0_0_25px_rgba(255,255,255,0.25)]'
            : rankStyle.borderColor
        }`}
      >
        {/* Poster Image */}
        <img
          src={posterSrc}
          alt={item.name}
          onError={handleImgError}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover transition-transform duration-300 ease-out filter brightness-95 group-hover:brightness-105"
          loading="lazy"
          decoding="async"
        />

        {/* Ambient Dark Bottom Gradient */}
        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-[#090912] via-[#090912]/85 to-transparent pointer-events-none z-10" />

        {/* Top-Right IMDb Rating */}
        {displayRating && (
          <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 px-2.5 py-0.5 rounded-xl text-[10px] sm:text-[11px] font-black text-amber-300 bg-black/85 border border-amber-400/50 shadow-md">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span className="font-black">{displayRating}</span>
          </div>
        )}

        {/* Bottom Metadata Info: Clean, single display of title and year */}
        <div className="absolute inset-x-0 bottom-0 p-2.5 sm:p-3 z-20 flex flex-col justify-end pointer-events-none">
          <h4 className="text-xs sm:text-sm font-bold text-white truncate drop-shadow-md group-hover:text-red-400 transition-colors">
            {item.name}
          </h4>
          <div className="flex items-center gap-1.5 text-[10px] text-slate-300 mt-0.5 font-medium">
            {releaseYear && <span className="font-semibold text-slate-200">{releaseYear}</span>}
            {releaseYear && <span>•</span>}
            <span className="truncate text-slate-400">{genreLabel}</span>
          </div>
        </div>

        {/* Quick Actions Hover Overlay */}
        <div
          className={`absolute inset-0 z-30 bg-black/60 p-3 flex flex-col justify-center items-center gap-3 transition-opacity duration-150 ${
            isHovered ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Large Play Button: Red for Movies, Purple for Series TV */}
          <button
            type="button"
            onClick={handlePlayClick}
            className={`w-13 h-13 rounded-full text-white flex items-center justify-center shadow-xl hover:scale-110 active:scale-95 transition-all cursor-pointer group/btn ${
              isMovie
                ? 'bg-gradient-to-r from-red-600 to-rose-600 shadow-red-600/50'
                : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 shadow-purple-600/50'
            }`}
            title={isMovie ? 'Riproduci Film' : 'Guarda Serie TV'}
          >
            <Play className="w-6 h-6 fill-current ml-0.5 group-hover/btn:scale-110 transition-transform" />
          </button>

          {/* "+ Aggiungi alla libreria" placed comfortably under the play button */}
          <button
            type="button"
            onClick={handleLibraryToggle}
            className={`px-3 py-1.5 rounded-full text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer border shadow-md active:scale-95 ${
              inLibrary
                ? 'bg-emerald-500/30 text-emerald-300 border-emerald-500/50'
                : 'liquid-glass-transparent text-white hover:text-white border-white/35 hover:bg-white/20'
            }`}
            title={inLibrary ? 'Rimuovi dalla Libreria' : 'Aggiungi alla Libreria'}
          >
            {inLibrary ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{inLibrary ? 'Salvato' : 'Libreria'}</span>
          </button>
        </div>
      </div>
    </div>
  );
});

NetflixTop10Card.displayName = 'NetflixTop10Card';
