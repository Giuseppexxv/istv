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

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(true); // default true for safe browser autoplay
  const [volume, setVolume] = useState<number>(0.85);
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

  // 1. Resolve Direct HLS Stream on mount or channel/reload change
  useEffect(() => {
    let isCancelled = false;
    setIsLoadingStream(true);
    setStreamError(null);
    setUseFallbackProxy(false);

    const fetchDirectStream = async () => {
      try {
        const resp = await fetch(`/api/live-stream?id=${channel.id}&refresh=${playerKey > 0 ? '1' : '0'}`, {
          signal: AbortSignal.timeout(9000),
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
    };
  }, [channel.id, playerKey]);

  // 2. Setup HLS.js for Native Playback
  useEffect(() => {
    if (useFallbackProxy || !nativeStreamUrl || !videoRef.current) {
      return;
    }

    const video = videoRef.current;
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Always prefer Hls.js MediaSource decoding first for Chrome, Edge, Firefox, and Android
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        capLevelToPlayerSize: true,
        maxBufferLength: 20,
        maxMaxBufferLength: 40,
      });

      hlsRef.current = hls;
      hls.loadSource(nativeStreamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const p = video.play();
        if (p !== undefined) {
          playPromiseRef.current = p;
          p.then(() => {
            if (playPromiseRef.current === p) playPromiseRef.current = null;
          }).catch(() => {
            if (playPromiseRef.current === p) playPromiseRef.current = null;
            setIsMuted(true);
            video.muted = true;
            const p2 = video.play();
            if (p2 !== undefined) {
              playPromiseRef.current = p2;
              p2.then(() => {
                if (playPromiseRef.current === p2) playPromiseRef.current = null;
              }).catch(() => {
                if (playPromiseRef.current === p2) playPromiseRef.current = null;
              });
            }
          });
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              console.warn('[HLS Fatal Error] Switching to fallback player:', data);
              hls.destroy();
              hlsRef.current = null;
              setUseFallbackProxy(true);
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native Apple Safari / iOS HLS
      video.src = nativeStreamUrl;
      const p = video.play();
      if (p !== undefined) {
        playPromiseRef.current = p;
        p.then(() => {
          if (playPromiseRef.current === p) playPromiseRef.current = null;
        }).catch(() => {
          if (playPromiseRef.current === p) playPromiseRef.current = null;
          setIsMuted(true);
          video.muted = true;
          const p2 = video.play();
          if (p2 !== undefined) {
            playPromiseRef.current = p2;
            p2.then(() => {
              if (playPromiseRef.current === p2) playPromiseRef.current = null;
            }).catch(() => {
              if (playPromiseRef.current === p2) playPromiseRef.current = null;
            });
          }
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
      if (!nextMuted && videoRef.current.volume === 0) {
        videoRef.current.volume = 0.8;
        setVolume(0.8);
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      if (val === 0) {
        videoRef.current.muted = true;
        setIsMuted(true);
      } else if (isMuted) {
        videoRef.current.muted = false;
        setIsMuted(false);
      }
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
      className="fixed inset-0 h-[100dvh] w-full z-50 bg-black flex flex-col items-center justify-center animate-in fade-in duration-200 select-none overflow-hidden cursor-default"
    >
      {/* TOP FLOATING HUD: Channel Info (Left) + Actions: Reload, Fullscreen, Close (X) (Right) */}
      <div
        className={`absolute top-3 inset-x-3 sm:top-4 sm:inset-x-6 z-40 flex items-center justify-between pointer-events-auto transition-opacity duration-300 ${
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* TOP LEFT: Channel Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-black/85 border border-white/20 backdrop-blur-xl shadow-2xl">
          <Radio className="w-3.5 h-3.5 text-red-500 animate-pulse flex-shrink-0" />
          <h2 className="text-xs sm:text-sm font-extrabold text-white truncate max-w-[180px] sm:max-w-sm">
            {channel.name}
          </h2>
        </div>

        {/* TOP RIGHT: Ricarica + Schermo Intero + Chiudi (X) */}
        <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 py-1.5 rounded-full bg-black/85 border border-white/20 backdrop-blur-2xl shadow-2xl">
          {/* Ricarica Stream */}
          <button
            type="button"
            onClick={handleReload}
            className="w-8 h-8 rounded-full bg-transparent hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title="Ricarica flusso live (R)"
          >
            <RefreshCw className="w-4 h-4 text-white" />
          </button>

          {/* Schermo Intero */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="w-8 h-8 rounded-full bg-transparent hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
            title="Schermo intero (F)"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-white" /> : <Maximize2 className="w-4 h-4 text-white" />}
          </button>

          {/* Chiudi (X) */}
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-rose-600/80 hover:bg-rose-600 text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-md ml-0.5"
            title="Chiudi player (Esc)"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>

      {/* UNMUTE FLOATING ACTION PILL (Shown when stream starts muted due to browser policy) */}
      {isMuted && !useFallbackProxy && !isLoadingStream && (
        <div className="absolute bottom-20 left-4 sm:left-6 z-40 animate-in fade-in duration-300">
          <button
            type="button"
            onClick={toggleMute}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs shadow-2xl transition-all cursor-pointer active:scale-95 animate-pulse"
          >
            <VolumeX className="w-4 h-4 text-white" />
            <span>Tocca per attivare l'audio</span>
          </button>
        </div>
      )}

      {/* VIDEO PLAYER CONTAINER */}
      <div className="flex-1 w-full h-full bg-black relative flex items-center justify-center overflow-hidden">
        {/* Loading Spinner */}
        {isLoadingStream && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/90 backdrop-blur-md">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-red-500/20 animate-ping" />
              <RefreshCw className="w-6 h-6 text-red-500 animate-spin" />
            </div>
            <p className="text-xs sm:text-sm font-bold text-white tracking-wide">
              Caricamento canale in corso...
            </p>
            <span className="text-[11px] text-slate-300 font-mono">
              {channel.name} • Live TV
            </span>
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
          className={`absolute bottom-3 inset-x-3 sm:bottom-6 sm:inset-x-6 z-40 flex items-center justify-start pointer-events-auto transition-opacity duration-300 ${
            showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/85 border border-white/20 backdrop-blur-2xl shadow-2xl">
            {/* Play / Pause Toggle */}
            <button
              type="button"
              onClick={togglePlay}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
              title={isPlaying ? 'Pausa (Spazio)' : 'Riproduci (Spazio)'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
            </button>

            {/* Mute / Unmute */}
            <button
              type="button"
              onClick={toggleMute}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
              title={isMuted ? 'Attiva audio (M)' : 'Disattiva audio (M)'}
            >
              {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-white" />}
            </button>

            {/* Volume Slider */}
            <div className="hidden sm:flex items-center w-20 px-1">
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-full h-1 bg-white/30 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
