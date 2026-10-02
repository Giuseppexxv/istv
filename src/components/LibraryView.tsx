import React, { useState, useEffect, useRef } from 'react';
import {
  Rewind,
  BookmarkCheck,
  Play,
  X,
  Film,
  Tv,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { StremioMetaPreview, StremioMetaDetail, StremioStream, StremioVideo, WatchHistoryItem } from '../types/stremio';
import { stremioService } from '../services/stremioService';
import { optimizeImageUrl } from '../utils/imageOptimizer';
import { MediaCard } from './MediaCard';

interface LibraryViewProps {
  onSelectMedia: (item: StremioMetaPreview) => void;
  onPlayStream: (media: StremioMetaDetail, stream?: StremioStream, video?: StremioVideo) => void;
}

function formatWatchTime(secs?: number): string {
  if (!secs || isNaN(secs) || secs <= 0) return '0 min';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) {
    return `${h}h ${m}m`;
  }
  return `${Math.max(1, m)} min`;
}

export const LibraryView: React.FC<LibraryViewProps> = ({ onSelectMedia, onPlayStream }) => {
  const [library, setLibrary] = useState<StremioMetaPreview[]>([]);
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const carouselRef = useRef<HTMLDivElement>(null);

  const loadData = () => {
    setLibrary(stremioService.getLibrary());
    setHistory(stremioService.getHistory());
  };

  useEffect(() => {
    loadData();
    window.addEventListener('storage', loadData);
    window.addEventListener('stremio_library_changed', loadData);
    window.addEventListener('stremio_history_changed', loadData);
    return () => {
      window.removeEventListener('storage', loadData);
      window.removeEventListener('stremio_library_changed', loadData);
      window.removeEventListener('stremio_history_changed', loadData);
    };
  }, []);

  const handleRemoveHistoryItem = (e: React.MouseEvent, h: WatchHistoryItem) => {
    e.stopPropagation();
    stremioService.removeFromHistory(h.id, h.videoId);
    setHistory(stremioService.getHistory());
  };

  const handleResumePlayback = (h: WatchHistoryItem) => {
    const isSeries = h.type === 'series';
    const mediaDetail: StremioMetaDetail = {
      id: h.id,
      type: h.type || 'movie',
      name: h.name,
      poster: h.poster,
      background: h.background || h.banner || h.poster,
      genres: h.genres,
    };

    const videoObj: StremioVideo | undefined =
      isSeries && (h.videoId || h.season !== undefined)
        ? {
            id: h.videoId || `${h.id}:${h.season || 1}:${h.episode || 1}`,
            title: h.episodeTitle || `Episodio ${h.episode || 1}`,
            season: h.season,
            episode: h.episode,
          }
        : undefined;

    onPlayStream(mediaDetail, undefined, videoObj);
  };

  const scrollCarousel = (direction: 'left' | 'right') => {
    if (!carouselRef.current) return;
    const cardWidth = carouselRef.current.clientWidth / 3;
    const scrollAmount = direction === 'left' ? -cardWidth * 2 : cardWidth * 2;
    carouselRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  return (
    <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16 pt-24 sm:pt-28 pb-16 space-y-12 animate-in fade-in duration-300">
      
      {/* 1. SEZIONE CONTINUA A GUARDARE */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-[0_0_16px_rgba(245,158,11,0.35)] flex items-center justify-center">
              <Rewind className="w-5 h-5 fill-amber-400/20 stroke-[2.5]" />
            </span>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
                Continua a guardare
              </h2>
            </div>
          </div>

          {history.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => scrollCarousel('left')}
                className="w-8 h-8 rounded-full liquid-glass-transparent border border-white/20 text-slate-300 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer shadow-md"
                title="Scorri indietro"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollCarousel('right')}
                className="w-8 h-8 rounded-full liquid-glass-transparent border border-white/20 text-slate-300 hover:text-white hover:bg-white/10 flex items-center justify-center transition-all cursor-pointer shadow-md"
                title="Scorri avanti"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {history.length === 0 ? (
          <div className="p-12 sm:p-16 rounded-3xl liquid-glass border border-white/10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto">
              <Rewind className="w-5 h-5 stroke-[2]" />
            </div>
            <h4 className="text-base font-bold text-slate-200">Cronologia vuota</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              Inizia a guardare qualsiasi film o serie TV per ritrovare qui i tuoi progressi e riprendere la visione all'istante.
            </p>
          </div>
        ) : (
          <div className="relative">
            <div
              ref={carouselRef}
              className="flex gap-4 sm:gap-5 overflow-x-auto pb-5 pt-4 scroll-smooth scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0"
            >
              {history.map((h, i) => {
                const isMovie = h.type === 'movie';
                const typeLabel = isMovie ? 'Film' : 'Serie TV';

                const bannerImg =
                  h.background ||
                  h.banner ||
                  (h.id?.startsWith('tt') ? `https://images.metahub.space/background/medium/${h.id}/img` : null) ||
                  h.poster ||
                  'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=800&q=80';

                let progressPercent = 0;
                if (h.progress && h.progress > 0) {
                  progressPercent = Math.min(100, Math.max(5, h.progress));
                } else if (h.duration && h.duration > 0 && h.currentTime) {
                  progressPercent = Math.min(100, Math.max(5, Math.round((h.currentTime / h.duration) * 100)));
                } else {
                  progressPercent = 25;
                }

                const curSeconds = h.currentTime || 0;
                const totalSeconds = h.duration || 0;
                const remainingSeconds = Math.max(0, totalSeconds - curSeconds);

                return (
                  <div
                    key={`${h.id}-${h.videoId || i}`}
                    onClick={() => handleResumePlayback(h)}
                    className="group relative flex-shrink-0 w-[85vw] sm:w-[calc(50%-12px)] lg:w-[calc((100%-40px)/3)] rounded-2xl overflow-hidden cursor-pointer select-none bg-[#0e0e18] border border-white/10 hover:border-amber-500/60 hover:shadow-[0_12px_32px_rgba(245,158,11,0.25)] transition-all duration-300 hover:-translate-y-1"
                  >
                    <div className="relative aspect-[16/9.5] w-full overflow-hidden bg-[#0a0a12]">
                      <img
                        src={optimizeImageUrl(bannerImg, 'background') || bannerImg}
                        alt={h.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 filter brightness-90 group-hover:brightness-100"
                        loading="lazy"
                      />

                      <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/85 via-black/40 to-transparent pointer-events-none z-10" />
                      <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#0e0e18] via-[#0e0e18]/80 to-transparent pointer-events-none z-10" />

                      <div className="absolute top-2.5 left-2.5 z-20 flex items-center gap-1.5 pointer-events-none">
                        <div className={`flex items-center gap-1.5 text-[10px] font-black px-2.5 py-0.5 rounded-lg liquid-glass-transparent border shadow-md backdrop-blur-xl ${
                          isMovie ? 'border-rose-500/40 text-rose-300' : 'border-purple-500/40 text-purple-300'
                        }`}>
                          {isMovie ? (
                            <Film className="w-3 h-3 text-rose-400" />
                          ) : (
                            <Tv className="w-3 h-3 text-purple-400" />
                          )}
                          <span className="font-black tracking-wide text-white uppercase">{typeLabel}</span>
                        </div>
                      </div>

                      {/* Pallino di cancellazione sempre visibile */}
                      <div className="absolute top-2.5 right-2.5 z-30">
                        <button
                          type="button"
                          onClick={(e) => handleRemoveHistoryItem(e, h)}
                          className="w-7 h-7 sm:w-7.5 sm:h-7.5 rounded-full bg-black/80 hover:bg-rose-600 text-white/90 hover:text-white border border-white/30 hover:border-rose-400 flex items-center justify-center transition-all duration-200 cursor-pointer backdrop-blur-xl shadow-lg active:scale-90"
                          title="Rimuovi da Continua a guardare"
                          aria-label="Rimuovi da Continua a guardare"
                        >
                          <X className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                      </div>

                      <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
                        <div className="w-12 h-12 rounded-full bg-amber-500/90 text-white flex items-center justify-center shadow-xl shadow-amber-500/40 border border-white/30 backdrop-blur-md group-hover:scale-110 group-hover:bg-amber-400 transition-all duration-300">
                          <Play className="w-5 h-5 fill-white ml-0.5" />
                        </div>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 z-20 h-1.5 bg-black/70 backdrop-blur-sm">
                        <div
                          className="h-full bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 rounded-r-full transition-all duration-300 shadow-[0_0_8px_rgba(245,158,11,0.8)]"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>

                    <div className="p-3 sm:p-3.5 flex flex-col justify-between bg-[#0e0e18] relative z-20">
                      <div>
                        <h4
                          className="text-sm sm:text-base font-bold text-white line-clamp-1 group-hover:text-amber-300 transition-colors"
                          title={h.name}
                        >
                          {h.name}
                        </h4>

                        {!isMovie && (
                          <p className="text-xs text-purple-300 font-semibold line-clamp-1 mt-0.5">
                            Stagione {h.season || 1} • Episodio {h.episode || 1}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mt-2.5">
                        <Play className="w-3 h-3 fill-amber-400 text-amber-400 flex-shrink-0" />
                        {totalSeconds > 0 ? (
                          <div className="flex items-center gap-1 text-[11px] sm:text-xs">
                            <span className="text-amber-400 font-bold">{formatWatchTime(curSeconds)} visti</span>
                            <span className="text-slate-500">•</span>
                            <span className="text-slate-300">{formatWatchTime(remainingSeconds)} rimanenti</span>
                          </div>
                        ) : (
                          <span className="text-amber-400 font-bold">
                            {curSeconds > 0 ? `${formatWatchTime(curSeconds)} visti` : 'Riprendi riproduzione'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* 2. SEZIONE SALVATI NELLA LIBRERIA (IN LUNGO - WIDESCREEN LANDSCAPE CARDS) */}
      <section className="space-y-5">
        <div className="flex items-center gap-3">
          <span className="p-2 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shadow-[0_0_16px_rgba(245,158,11,0.35)] flex items-center justify-center">
            <BookmarkCheck className="w-5 h-5 fill-amber-500/25 stroke-[2.5]" />
          </span>
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Salvati nella Libreria
            </h2>
          </div>
        </div>

        {library.length === 0 ? (
          <div className="p-12 sm:p-16 rounded-3xl liquid-glass border border-white/10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mx-auto">
              <BookmarkCheck className="w-6 h-6 stroke-[2]" />
            </div>
            <h4 className="text-base font-bold text-slate-200">La tua libreria è vuota</h4>
            <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
              Esplora Scopri, Film o Serie TV e tocca il pulsante "Aggiungi alla Libreria" su qualsiasi locandina per salvarla qui.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5 pt-2 pb-6">
            {library.map((item) => (
              <MediaCard
                key={item.id}
                item={item}
                onSelect={onSelectMedia}
                onQuickPlay={(m) => {
                  onSelectMedia(m);
                }}
                onRemove={(m) => {
                  stremioService.toggleLibraryItem(m);
                  setLibrary(stremioService.getLibrary());
                }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
