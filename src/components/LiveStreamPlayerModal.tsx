import React, { useState, useRef, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import {
  X,
  RefreshCw,
  Maximize2,
  Minimize2,
  Radio,
  Volume2,
  VolumeX,
  Play,
  Pause,
  Loader2,
} from 'lucide-react';
import { LiveChannel } from '../services/liveTvService';

interface LiveStreamPlayerModalProps {
  channel: LiveChannel;
  onClose: () => void;
}

export const LiveStreamPlayerModal: React.FC<LiveStreamPlayerModalProps> = ({
  channel,
  onClose,
}) => {
  const [playerKey, setPlayerKey] = useState<number>(0);
  const [isLoadingStream, setIsLoadingStream] = useState<boolean>(true);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [useFallbackProxy, setUseFallbackProxy] = useState<boolean>(false);

  // Playback state - Starts active with full audio enabled
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [volume, setVolume] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const hideControlsTimerRef = useRef<any>(null);

  // Direct HLS stream URL resolved from backend
  const [nativeStreamUrl, setNativeStreamUrl] = useState<string | null>(null);

  // Fallback player URL
  const proxiedWebUrl = `/api/live-proxy?id=${channel.id}`;

  const isPlayingRef = useRef<boolean>(true);
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // Controls visibility timeout
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimerRef.current) {
      clearTimeout(hideControlsTimerRef.current);
    }
    hideControlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 4500);
  }, []);

  // Automatic Picture-in-Picture on mobile and tablet when leaving site, backgrounding or switching apps
  useEffect(() => {
    if (videoRef.current) {
      try {
        (videoRef.current as any).autoPictureInPicture = true;
      } catch {}
    }

    const handleVisibilityOrPageHide = async () => {
      if (document.visibilityState !== 'hidden') return;
      const video = videoRef.current;
      if (!video) return;

      const isActivelyPlaying = isPlayingRef.current || (!video.paused && video.currentTime > 0);
      if (!isActivelyPlaying) return;

      try {
        if (
          typeof (video as any).webkitSupportsPresentationMode === 'function' &&
          (video as any).webkitSupportsPresentationMode('picture-in-picture')
        ) {
          if ((video as any).webkitPresentationMode !== 'picture-in-picture') {
            (video as any).webkitSetPresentationMode('picture-in-picture');
          }
        } else if (
          document.pictureInPictureEnabled &&
          typeof video.requestPictureInPicture === 'function' &&
          document.pictureInPictureElement !== video
        ) {
          await video.requestPictureInPicture();
        }
      } catch {}
    };

    document.addEventListener('visibilitychange', handleVisibilityOrPageHide);
    window.addEventListener('pagehide', handleVisibilityOrPageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityOrPageHide);
      window.removeEventListener('pagehide', handleVisibilityOrPageHide);
    };
  }, []);

  // 1. Resolve Direct HLS Stream on mount or channel/reload change
  useEffect(() => {
    let isCancelled = false;
    const controller = new AbortController();
    setNativeStreamUrl(null);
    setIsLoadingStream(true);
    setStreamError(null);
    setUseFallbackProxy(false);

    const fetchDirectStream = async () => {
      try {
        const resp = await fetch(`/api/live-stream?id=${encodeURIComponent(channel.id)}&refresh=${playerKey > 0 ? '1' : '0'}`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]),
        });

        if (!resp.ok) {
          throw new Error(`Errore server (${resp.status})`);
        }

        const data = await resp.json();
        if (isCancelled) return;

        if (data && data.success && data.streamUrl) {
          setNativeStreamUrl(data.streamUrl);
          setIsLoadingStream(false);
        } else {
          throw new Error(data?.error || 'Flusso non disponibile');
        }
      } catch (err: any) {
        if (isCancelled) return;
        console.warn(`[Live TV] Direct stream resolve error for channel ${channel.id}:`, err.message);
        // Fallback to proxied player if direct extraction fails
        setUseFallbackProxy(true);
        setIsLoadingStream(false);
      }
    };

    fetchDirectStream();

    return () => {
      isCancelled = true;
      controller.abort();
    };
  }, [channel.id, playerKey]);

  // 2. Setup HLS.js with resilient live buffer tuning and immediate audio playback
  useEffect(() => {
    if (useFallbackProxy || !nativeStreamUrl || !videoRef.current) {
      return;
    }

    const video = videoRef.current;
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Configure video element for direct unmuted playback
    video.muted = false;
    video.volume = volume > 0 ? volume : 1;

    // Advanced HLS.js configuration optimized for live IPTV stream reception and anti-freeze
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 30,
        maxBufferLength: 25,
        maxMaxBufferLength: 50,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 8,
        liveDurationInfinity: true,
        startFragPrefetch: true,
        capLevelToPlayerSize: true,
        manifestLoadingTimeOut: 12000,
        manifestLoadingMaxRetry: 5,
        manifestLoadingRetryDelay: 800,
        levelLoadingTimeOut: 12000,
        levelLoadingMaxRetry: 5,
        levelLoadingRetryDelay: 800,
        fragLoadingTimeOut: 15000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 800,
      });

      hlsRef.current = hls;
      hls.loadSource(nativeStreamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.muted = false;
        video.volume = volume > 0 ? volume : 1;
        const p = video.play();
        if (p !== undefined) {
          playPromiseRef.current = p;
          p.then(() => {
            if (playPromiseRef.current === p) playPromiseRef.current = null;
            setIsPlaying(true);
            setIsMuted(false);
          }).catch((err) => {
            if (playPromiseRef.current === p) playPromiseRef.current = null;
            console.warn('[Live TV Autoplay Blocked] Starting muted per browser policy:', err);
            video.muted = true;
            setIsMuted(true);
            const p2 = video.play();
            if (p2 !== undefined) {
              playPromiseRef.current = p2;
              p2.then(() => {
                if (playPromiseRef.current === p2) playPromiseRef.current = null;
                setIsPlaying(true);
              }).catch(() => {});
            }
          });
        }
      });

      // Self-healing recovery on stream drops or temporary network glitches
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('[Live TV Network Error] Reloading stream chunks...', data);
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('[Live TV Media Error] Recovering playback...', data);
              hls.recoverMediaError();
              break;
            default:
              console.warn('[Live TV Fatal Error] Switching to stream refresh:', data);
              hls.destroy();
              hlsRef.current = null;
              setPlayerKey((prev) => prev + 1);
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Apple Safari / iOS HLS
      video.src = nativeStreamUrl;
      video.muted = false;
      video.volume = volume > 0 ? volume : 1;
      const p = video.play();
      if (p !== undefined) {
        playPromiseRef.current = p;
        p.then(() => {
          if (playPromiseRef.current === p) playPromiseRef.current = null;
          setIsPlaying(true);
          setIsMuted(false);
        }).catch(() => {
          if (playPromiseRef.current === p) playPromiseRef.current = null;
          setIsMuted(true);
          video.muted = true;
          video.play().catch(() => {});
        });
      }
    } else {
      setUseFallbackProxy(true);
    }

    return () => {
      if (videoRef.current) {
        try {
          videoRef.current.pause();
          videoRef.current.removeAttribute('src');
          videoRef.current.load();
        } catch {}
      }
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [useFallbackProxy, nativeStreamUrl, playerKey]);

  // 3. User interaction listener for auto-hiding controls
  useEffect(() => {
    resetControlsTimeout();

    const handleUserInteraction = () => {
      resetControlsTimeout();
    };

    window.addEventListener('mousemove', handleUserInteraction);
    window.addEventListener('pointermove', handleUserInteraction);
    window.addEventListener('touchstart', handleUserInteraction);
    window.addEventListener('touchmove', handleUserInteraction);
    window.addEventListener('click', handleUserInteraction);

    return () => {
      if (hideControlsTimerRef.current) {
        clearTimeout(hideControlsTimerRef.current);
      }
      window.removeEventListener('mousemove', handleUserInteraction);
      window.removeEventListener('pointermove', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('touchmove', handleUserInteraction);
      window.removeEventListener('click', handleUserInteraction);
    };
  }, [resetControlsTimeout]);

  // 4. Keyboard shortcuts & Anti-popup shield trap
  useEffect(() => {
    // Override window.open at document level to block rogue popup scripts
    const originalWindowOpen = window.open;
    window.open = function () {
      console.warn('[Popup Shield] Prevented external window.open attempt');
      return null;
    };

    // Capture-phase link click interception
    const handleCaptureClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest('a');
      if (anchor) {
        const href = anchor.getAttribute('href') || '';
        const linkTarget = anchor.getAttribute('target') || '';
        if (
          linkTarget === '_blank' ||
          linkTarget === '_new' ||
          linkTarget === '_top' ||
          linkTarget === '_parent' ||
          e.button === 1 ||
          (href && href.startsWith('http') && !href.startsWith(window.location.origin))
        ) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          console.warn('[Popup Shield] Prevented external redirect click:', href);
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === ' ') {
        e.preventDefault();
        togglePlay();
      } else if (e.key.toLowerCase() === 'm') {
        toggleMute();
      } else if (e.key.toLowerCase() === 'f') {
        toggleFullscreen();
      } else if (e.key.toLowerCase() === 'r') {
        handleReload();
      }
    };

    window.addEventListener('click', handleCaptureClick, true);
    window.addEventListener('auxclick', handleCaptureClick, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.open = originalWindowOpen;
      window.removeEventListener('click', handleCaptureClick, true);
      window.removeEventListener('auxclick', handleCaptureClick, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleReload = () => {
    setPlayerKey((prev) => prev + 1);
    setIsLoadingStream(true);
    resetControlsTimeout();
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        const p = videoRef.current.play();
        if (p !== undefined) {
          playPromiseRef.current = p;
          p.then(() => {
            if (playPromiseRef.current === p) playPromiseRef.current = null;
          }).catch(() => {
            if (playPromiseRef.current === p) playPromiseRef.current = null;
          });
        }
        setIsPlaying(true);
      } else {
        if (playPromiseRef.current) {
          playPromiseRef.current
            .then(() => {
              if (videoRef.current) {
                videoRef.current.pause();
              }
            })
            .catch(() => {
              if (videoRef.current) {
                videoRef.current.pause();
              }
            });
        } else {
          videoRef.current.pause();
        }
        setIsPlaying(false);
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const nextMuted = !isMuted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
      if (!nextMuted) {
        const targetVol = volume > 0.05 ? volume : 0.8;
        videoRef.current.volume = targetVol;
        setVolume(targetVol);
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      if (val === 0) {
        videoRef.current.muted = true;
        setIsMuted(true);
      } else {
        videoRef.current.muted = false;
        videoRef.current.volume = val;
        setIsMuted(false);
      }
    }
  };

  const handleContainerClick = () => {
    resetControlsTimeout();
    if (isMuted && videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.volume = volume > 0 ? volume : 1;
      setIsMuted(false);
    }
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      try {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.warn('Fullscreen error:', err);
      }
    } else {
      try {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } catch (err) {
        console.warn('Exit fullscreen error:', err);
      }
    }
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimeout}
      onTouchStart={resetControlsTimeout}
      onClick={handleContainerClick}
      className="fixed inset-0 h-[100dvh] w-full z-50 bg-black flex flex-col items-center justify-center animate-in fade-in duration-200 select-none overflow-hidden cursor-default"
    >
      {/* ================= TOP HUD BAR ================= */}
      <div
        className={`absolute top-0 left-0 right-0 p-3 sm:p-5 bg-gradient-to-b from-black/95 via-black/50 to-transparent transition-opacity duration-300 z-40 ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex items-center justify-between">
          {/* TOP LEFT: Channel Badge & Live Indicator */}
          <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 max-w-[70%]">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl liquid-glass-transparent border border-white/20 shadow-xl backdrop-blur-xl">
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-600/25 border border-red-500/40 text-red-300 text-[10px] sm:text-[11px] font-black uppercase tracking-wider shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span>LIVE</span>
              </div>
              <h2 className="font-poster-logo text-xs sm:text-sm md:text-base font-black text-white tracking-wide uppercase truncate drop-shadow-md">
                {channel.name}
              </h2>
            </div>
          </div>

          {/* TOP RIGHT: Ricarica + Schermo Intero + Chiudi (X) */}
          <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
            {/* Ricarica Stream */}
            <button
              type="button"
              onClick={handleReload}
              className="w-10 h-10 rounded-2xl liquid-glass-transparent hover:bg-white/25 text-white flex items-center justify-center transition-all border border-white/25 cursor-pointer shadow-lg hover:scale-105 active:scale-95"
              title="Ricarica flusso live (R)"
            >
              <RefreshCw className="w-4 h-4 text-white" />
            </button>

            {/* Schermo Intero: nascosto su mobile e tablet, visibile solo su desktop */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="hidden lg:flex w-10 h-10 rounded-2xl liquid-glass-transparent hover:bg-white/25 text-white items-center justify-center transition-all border border-white/25 cursor-pointer shadow-lg hover:scale-105 active:scale-95"
              title="Schermo intero (F)"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4 text-white" /> : <Maximize2 className="w-4 h-4 text-white" />}
            </button>

            {/* Chiudi (X) */}
            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-2xl liquid-glass-transparent hover:bg-rose-600 text-white flex items-center justify-center transition-all border border-white/25 cursor-pointer shadow-lg hover:scale-105 active:scale-95"
              title="Chiudi player (Esc)"
            >
              <X className="w-4.5 h-4.5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* UNMUTE FLOATING ACTION PILL REMOVED */}

      {/* VIDEO PLAYER CONTAINER */}
      <div className="flex-1 w-full h-full bg-black relative flex items-center justify-center overflow-hidden">
        {/* Loading Spinner */}
        {isLoadingStream && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
            <div className="liquid-glass-elevated rounded-3xl p-6 sm:p-8 border border-white/20 shadow-2xl flex flex-col items-center gap-3.5 max-w-sm w-full mx-4 text-center">
              <div className="relative w-14 h-14 flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-red-500/20 animate-ping" />
                <div className="w-12 h-12 rounded-full border-3 border-red-500 border-t-transparent animate-spin" />
                <Radio className="w-5 h-5 text-red-500 absolute" />
              </div>
              <div className="space-y-1">
                <h3 className="font-poster-logo text-sm sm:text-base font-black text-white tracking-wider uppercase">
                  {channel.name}
                </h3>
                <p className="text-xs text-slate-300 font-medium">
                  Sintonizzazione canale in corso...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Primary Engine: Direct HLS HTML5 Video Player */}
        {!useFallbackProxy && nativeStreamUrl && (
          <video
            ref={videoRef}
            key={`native-${nativeStreamUrl}-${playerKey}`}
            autoPlay
            playsInline
            muted={isMuted}
            onClick={togglePlay}
            {...({
              autopictureinpicture: 'true',
              'webkit-playsinline': 'true',
              'x-webkit-airplay': 'allow',
            } as any)}
            onError={(e) => {
              console.warn('[Live Video Error] Playback issue, switching to fallback:', e);
              if (hlsRef.current) {
                hlsRef.current.destroy();
                hlsRef.current = null;
              }
              setUseFallbackProxy(true);
            }}
            className="w-full h-full object-contain bg-black cursor-pointer"
          />
        )}

        {/* Fallback Engine: Clean Proxied Player */}
        {useFallbackProxy && (
          <iframe
            ref={iframeRef}
            key={`fallback-${proxiedWebUrl}-${playerKey}`}
            src={proxiedWebUrl}
            title={channel.name}
            loading="eager"
            className="w-full h-full border-0 bg-black"
            allow="autoplay *; fullscreen *; encrypted-media *; picture-in-picture *; accelerometer; gyroscope; volume *; audio *"
            allowFullScreen
          />
        )}
      </div>

      {/* BOTTOM CONTROLS BAR: Play / Pause / Mute / Volume Slider */}
      {!useFallbackProxy && (
        <div
          className={`absolute bottom-3 sm:bottom-5 inset-x-3 sm:inset-x-6 z-40 flex items-center justify-start pointer-events-auto transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="liquid-glass-transparent rounded-2xl px-3 py-2 sm:px-4 sm:py-2.5 border border-white/20 shadow-2xl backdrop-blur-2xl flex items-center gap-2 sm:gap-3">
            {/* Play / Pause Toggle */}
            <button
              type="button"
              onClick={togglePlay}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl liquid-glass-transparent hover:bg-white/20 text-slate-200 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 border border-white/20 shadow-md"
              title={isPlaying ? 'Pausa (Spazio)' : 'Riproduci (Spazio)'}
            >
              {isLoadingStream ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            {/* Mute / Unmute */}
            <button
              type="button"
              onClick={toggleMute}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl liquid-glass-transparent hover:bg-white/20 text-slate-200 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 border border-white/20 shadow-md"
              title={isMuted ? 'Attiva audio (M)' : 'Disattiva audio (M)'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-white" />}
            </button>

            {/* Volume Slider: nascosto su mobile e tablet, visibile solo su desktop */}
            <div
              onClick={(e) => e.stopPropagation()}
              className="hidden lg:flex items-center w-20 sm:w-24 px-1"
            >
              <input
                type="range"
                min="0"
                max="1"
                step="0.02"
                value={isMuted ? 0 : volume}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onChange={handleVolumeChange}
                className="w-full h-1 bg-white/25 rounded-lg appearance-none cursor-pointer accent-white hover:accent-red-500 transition-all"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
