import React, { useState, useRef, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  X,
  PictureInPicture2,
  AlertCircle,
  Settings,
  Check,
  ChevronLeft,
  ChevronRight,
  Sliders,
  Languages,
  Subtitles as SubtitlesIcon,
  SkipForward,
} from 'lucide-react';
import {
  StremioMetaDetail,
  StremioStream,
  StremioVideo,
  StremioSubtitle,
} from '../types/stremio';
import { stremioService } from '../services/stremioService';

interface LiquidPlayerProps {
  media: StremioMetaDetail;
  stream?: StremioStream | null;
  video?: StremioVideo;
  onClose: () => void;
}

interface AudioTrackInfo {
  id: number;
  name: string;
  lang?: string;
}

interface QualityLevelInfo {
  id: number;
  height: number;
  bitrate: number;
  name: string;
}

interface SubtitleCue {
  id: number;
  start: number;
  end: number;
  text: string;
}

function parseSubtitleContent(content: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.split(/\n\s*\n/);

  const timeToSeconds = (timeStr: string): number => {
    const parts = timeStr.trim().split(':');
    if (parts.length === 3) {
      const hours = parseFloat(parts[0]) || 0;
      const minutes = parseFloat(parts[1]) || 0;
      const seconds = parseFloat(parts[2].replace(',', '.')) || 0;
      return hours * 3600 + minutes * 60 + seconds;
    } else if (parts.length === 2) {
      const minutes = parseFloat(parts[0]) || 0;
      const seconds = parseFloat(parts[1].replace(',', '.')) || 0;
      return minutes * 60 + seconds;
    }
    return 0;
  };

  let index = 0;
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    let timeLineIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('-->')) {
        timeLineIdx = i;
        break;
      }
    }

    if (timeLineIdx !== -1) {
      const timeLine = lines[timeLineIdx];
      const [startStr, endStr] = timeLine.split('-->');
      if (startStr && endStr) {
        const start = timeToSeconds(startStr);
        const end = timeToSeconds(endStr.trim().split(' ')[0]);
        const textLines = lines.slice(timeLineIdx + 1);
        const text = textLines
          .join('\n')
          .replace(/<[^>]+>/g, '')
          .trim();

        if (text && end > start) {
          cues.push({
            id: index++,
            start,
            end,
            text,
          });
        }
      }
    }
  }

  return cues;
}

// Universal stream proxy URL builder
function getStreamProxyUrl(targetUrl: string, streamObj: StremioStream): string {
  if (!targetUrl || targetUrl.startsWith('blob:')) return targetUrl;
  if (targetUrl.startsWith('/api/stream-proxy')) return targetUrl;

  let customHeaders: Record<string, string> = {};
  if (streamObj.behaviorHints?.proxyHeaders) {
    const raw =
      (streamObj.behaviorHints.proxyHeaders as any).request ||
      streamObj.behaviorHints.proxyHeaders;
    if (typeof raw === 'object' && raw !== null) {
      customHeaders = { ...raw };
    }
  }

  const isHls = targetUrl.includes('.m3u8') || streamObj.name?.toLowerCase().includes('hls');
  const needsProxy =
    isHls ||
    Object.keys(customHeaders).length > 0 ||
    streamObj.behaviorHints?.notWebReady ||
    !targetUrl.startsWith(window.location.origin);

  if (needsProxy) {
    let proxied = `/api/stream-proxy?url=${encodeURIComponent(targetUrl)}`;
    if (Object.keys(customHeaders).length > 0) {
      proxied += `&headers=${encodeURIComponent(JSON.stringify(customHeaders))}`;
      if (customHeaders['Referer']) {
        proxied += `&referer=${encodeURIComponent(customHeaders['Referer'])}`;
      }
      if (customHeaders['Origin']) {
        proxied += `&origin=${encodeURIComponent(customHeaders['Origin'])}`;
      }
    }
    return proxied;
  }

  return targetUrl;
}

export const LiquidPlayer: React.FC<LiquidPlayerProps> = ({
  media,
  stream: initialStream,
  video: initialVideo,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);

  // Web Audio booster
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioSourceRef = useRef<MediaElementAudioSourceNode | null>(null);

  // Active stream and video resolution state
  const [activeStream, setActiveStream] = useState<StremioStream | null>(
    initialStream && (initialStream.url || initialStream.externalUrl) ? initialStream : null
  );
  const [activeVideo, setActiveVideo] = useState<StremioVideo | undefined>(initialVideo);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [volumeBoost] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  // Multi-Track & Settings state
  const [audioTracks, setAudioTracks] = useState<AudioTrackInfo[]>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<number>(-1);
  const [qualityLevels, setQualityLevels] = useState<QualityLevelInfo[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number>(-1); // -1 is Auto
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'root' | 'quality' | 'subtitles' | 'audio'>('root');

  // Subtitles state & persistence
  const [subtitles, setSubtitles] = useState<StremioSubtitle[]>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState<string | null>(null);
  const [activeCues, setActiveCues] = useState<SubtitleCue[]>([]);
  const [currentSubtitleText, setCurrentSubtitleText] = useState<string | null>(null);

  // Series Episodes Management & Next Episode Transition
  const [allVideos, setAllVideos] = useState<StremioVideo[]>(media.videos || []);
  const [showNextEpisodePrompt, setShowNextEpisodePrompt] = useState(false);
  const [dismissedNextPrompt, setDismissedNextPrompt] = useState<string | null>(null);
  const hasAutoAdvancedRef = useRef(false);
  const isTransitioningRef = useRef(false);

  // Rotation animation state for 10s skip buttons
  const [rotateAnim, setRotateAnim] = useState<'left' | 'right' | null>(null);

  // Load all series episodes if not already populated in media
  useEffect(() => {
    if (media.type === 'series') {
      if (media.videos && media.videos.length > 0) {
        setAllVideos(media.videos);
      } else {
        stremioService.fetchMeta('series', media.id).then((meta) => {
          if (meta?.videos && meta.videos.length > 0) {
            setAllVideos(meta.videos);
          }
        }).catch(() => {});
      }
    }
  }, [media.id, media.type, media.videos]);

  // Compute next video/episode
  const nextVideo = React.useMemo<StremioVideo | null>(() => {
    if (media.type !== 'series' || allVideos.length === 0) return null;

    if (!activeVideo) {
      return allVideos.length > 1 ? allVideos[1] : null;
    }

    const currentIndex = allVideos.findIndex(
      (v) => v.id === activeVideo.id || (v.season === activeVideo.season && v.episode === activeVideo.episode)
    );

    if (currentIndex !== -1 && currentIndex + 1 < allVideos.length) {
      return allVideos[currentIndex + 1];
    }

    const nextInSameSeason = allVideos.find(
      (v) => v.season === activeVideo.season && v.episode === (activeVideo.episode || 1) + 1
    );
    if (nextInSameSeason) return nextInSameSeason;

    const nextSeasonFirstEp = allVideos.find(
      (v) => v.season === (activeVideo.season || 1) + 1 && (v.episode === 1 || v.episode === 0)
    );
    if (nextSeasonFirstEp) return nextSeasonFirstEp;

    return null;
  }, [media.type, allVideos, activeVideo]);

  // Next episode prompt in final minutes/seconds of current episode
  useEffect(() => {
    if (!nextVideo || !duration || duration < 60) {
      setShowNextEpisodePrompt(false);
      return;
    }
    const remaining = duration - currentTime;
    const currentEpKey = activeVideo?.id || `${activeVideo?.season}:${activeVideo?.episode}`;

    // Trigger in the last 90 seconds (1.5 minutes) of the episode
    if (remaining <= 90 && remaining > 3 && dismissedNextPrompt !== currentEpKey) {
      setShowNextEpisodePrompt(true);
    } else if (remaining > 100 || remaining <= 2) {
      setShowNextEpisodePrompt(false);
    }
  }, [currentTime, duration, nextVideo, activeVideo, dismissedNextPrompt]);

  // Action to smoothly transition to next episode
  const handlePlayNextEpisode = useCallback((targetNextVideo?: StremioVideo) => {
    let target = targetNextVideo || nextVideo;
    if (!target && media.type === 'series' && allVideos.length > 0) {
      const curIdx = allVideos.findIndex(
        (v) => v.id === activeVideo?.id || (v.season === activeVideo?.season && v.episode === activeVideo?.episode)
      );
      if (curIdx !== -1 && curIdx + 1 < allVideos.length) {
        target = allVideos[curIdx + 1];
      }
    }
    if (!target) return;

    isTransitioningRef.current = true;
    hasAutoAdvancedRef.current = true;
    hasResumedRef.current = true;
    targetResumeTimeRef.current = 0;
    lastProgressSaveRef.current = 0;

    setIsPlaying(false);
    setIsLoading(true);
    setLoadingText(`Caricamento Stagione ${target.season || 1} • Episodio ${target.episode || 1}...`);
    setPlaybackError(null);
    setCurrentTime(0);
    setDuration(0);
    setActiveCues([]);
    setCurrentSubtitleText(null);
    setShowNextEpisodePrompt(false);
    setDismissedNextPrompt(target.id || `${target.season}:${target.episode}`);

    if (videoRef.current) {
      try {
        const pauseVideo = () => {
          if (videoRef.current) {
            try {
              videoRef.current.pause();
              videoRef.current.currentTime = 0;
              videoRef.current.removeAttribute('src');
              videoRef.current.load();
            } catch {}
          }
        };

        if (playPromiseRef.current) {
          playPromiseRef.current.then(pauseVideo).catch(pauseVideo);
        } else {
          pauseVideo();
        }
      } catch {}
    }
    if (hlsRef.current) {
      try {
        hlsRef.current.stopLoad();
        hlsRef.current.destroy();
        hlsRef.current = null;
      } catch {}
    }

    setActiveStream(null);
    setActiveVideo(target);
  }, [nextVideo, media.type, allVideos, activeVideo]);

  // Loading & Diagnostics
  const [, setIsLoading] = useState(true);
  const [, setLoadingText] = useState<string>('Connessione in corso...');
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  // Resume playback refs
  const hasResumedRef = useRef(false);
  const targetResumeTimeRef = useRef<number>(0);
  const lastProgressSaveRef = useRef<number>(0);

  // Initialize or update target resume time & saved subtitles when media or active video changes
  useEffect(() => {
    const savedTime = stremioService.getSavedPlaybackTime(media.id, activeVideo?.id);
    targetResumeTimeRef.current = savedTime > 5 ? savedTime : 1;
    hasResumedRef.current = false;

    // Restore saved subtitle preference
    const savedSub = stremioService.getSavedSubtitlePreference(media.id, activeVideo?.id);
    if (savedSub && savedSub.url) {
      setSelectedSubtitle(savedSub.url);
    }
  }, [media.id, activeVideo?.id]);

  // 5-second loading timeout: if stream doesn't start playing within 5 seconds, reload and clean everything
  useEffect(() => {
    if (!activeStream) return;
    if (isPlaying) return;

    const timer = setTimeout(() => {
      if (!isPlaying) {
        console.warn("[LiquidPlayer] Stream failed to start within 5 seconds. Reloading...");
        
        // Clean everything
        if (videoRef.current) {
          try {
            videoRef.current.pause();
            videoRef.current.removeAttribute('src');
            videoRef.current.load();
          } catch {}
        }
        if (hlsRef.current) {
          try {
            hlsRef.current.stopLoad();
            hlsRef.current.destroy();
            hlsRef.current = null;
          } catch {}
        }
        
        // Reset playback states
        setIsPlaying(false);
        setIsLoading(true);
        setPlaybackError(null);
        setCurrentTime(0);
        setDuration(0);
        setActiveCues([]);
        setCurrentSubtitleText(null);
        
        // Reload stream source
        setActiveStream(null);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [activeStream, isPlaying]);

  // Hover Scrubber Preview
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState<number>(0);

  const controlsTimeoutRef = useRef<any>(null);

  // Fetch and parse active subtitle cues
  useEffect(() => {
    if (!selectedSubtitle) {
      setActiveCues([]);
      setCurrentSubtitleText(null);
      return;
    }

    let isCancelled = false;
    async function loadSubtitleContent() {
      try {
        const proxyUrl = `/api/stremio-proxy?url=${encodeURIComponent(selectedSubtitle!)}`;
        let resp = await fetch(proxyUrl).catch(() => null);
        if (!resp || !resp.ok) {
          resp = await fetch(selectedSubtitle!).catch(() => null);
        }
        if (resp && resp.ok) {
          const text = await resp.text();
          if (!isCancelled) {
            const parsed = parseSubtitleContent(text);
            setActiveCues(parsed);
          }
        }
      } catch (err) {
        console.warn('Failed to load subtitle cues', err);
      }
    }
    loadSubtitleContent();
    return () => {
      isCancelled = true;
    };
  }, [selectedSubtitle]);

  // Synchronize active subtitle text with current video time
  useEffect(() => {
    if (activeCues.length === 0) {
      if (currentSubtitleText !== null) setCurrentSubtitleText(null);
      return;
    }
    const matching = activeCues.find((c) => currentTime >= c.start && currentTime <= c.end);
    setCurrentSubtitleText(matching ? matching.text : null);
  }, [currentTime, activeCues, currentSubtitleText]);

  // Handler for user selecting or toggling subtitles
  const handleSelectSubtitle = (subUrl: string | null, subLang?: string, subId?: string) => {
    setSelectedSubtitle(subUrl);
    stremioService.saveSubtitlePreference(media.id, subUrl, subLang, subId, activeVideo?.id);
  };

  // Ultra-fast close handler
  const isClosingRef = useRef(false);
  const handleFastClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    if (videoRef.current) {
      try {
        const cur = videoRef.current.currentTime;
        const dur = videoRef.current.duration || 0;
        if (cur > 5) {
          stremioService.savePlaybackProgress(media.id, cur, dur, activeVideo?.id);
        }

        const pauseVideo = () => {
          if (videoRef.current) {
            try {
              videoRef.current.pause();
              videoRef.current.removeAttribute('src');
              videoRef.current.load();
            } catch {}
          }
        };

        if (playPromiseRef.current) {
          playPromiseRef.current.then(pauseVideo).catch(pauseVideo);
        } else {
          pauseVideo();
        }
      } catch (err) {
        console.warn('Failed to save progress or stop video in handleFastClose', err);
      }
    }
    if (hlsRef.current) {
      try {
        hlsRef.current.stopLoad();
        hlsRef.current.destroy();
        hlsRef.current = null;
      } catch {}
    }
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);

    onClose();
  }, [onClose, media.id, activeVideo?.id]);

  const handleSelectQuality = (lvlId: number) => {
    setSelectedQuality(lvlId);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = lvlId; // -1 = auto
    }
  };

  const handleSelectAudioTrack = (trackId: number) => {
    setSelectedAudioTrack(trackId);
    if (hlsRef.current) {
      hlsRef.current.audioTrack = trackId;
    }
  };

  // Check and apply resume playback position from history (runs once upon initial video load)
  const checkAndApplyResume = useCallback(() => {
    if (hasResumedRef.current) return;
    if (!videoRef.current) return;
    const target = targetResumeTimeRef.current >= 1 ? targetResumeTimeRef.current : 1;
    try {
      videoRef.current.currentTime = target;
      setCurrentTime(target);
      hasResumedRef.current = true;
      targetResumeTimeRef.current = 0;
    } catch {
      // Will retry when video buffer is ready
    }
  }, []);

  // Automatic stream resolution from ToastFlix if not provided
  useEffect(() => {
    let isCancelled = false;

    async function resolveStream() {
      setIsLoading(true);
      setLoadingText('Connessione in corso...');
      setPlaybackError(null);

      try {
        let streamTargetId = media.id;
        let resolvedVideo = activeVideo;

        // If series, ensure we have an episode target
        if (media.type === 'series') {
          if (!resolvedVideo) {
            if (media.videos && media.videos.length > 0) {
              resolvedVideo = media.videos[0];
              setActiveVideo(resolvedVideo);
              streamTargetId = resolvedVideo.id;
            } else {
              setLoadingText('Aspetta, connessione in corso...');
              const meta = await stremioService.fetchMeta('series', media.id);
              if (isCancelled) return;
              if (meta?.videos && meta.videos.length > 0) {
                resolvedVideo = meta.videos[0];
                setActiveVideo(resolvedVideo);
                streamTargetId = resolvedVideo.id;
              }
            }
          } else {
            streamTargetId = resolvedVideo.id;
          }
        }

        // Fetch streams
        let streams = await stremioService.fetchStreams(media.type, streamTargetId);
        if (isCancelled) return;

        if (!streams || streams.length === 0) {
          setLoadingText('Attendi, cambio sorgente...');
          try {
            const secondaryStreams = await stremioService.fetchSecondaryStreams(
              media.type,
              streamTargetId
            );
            if (isCancelled) return;
            if (secondaryStreams && secondaryStreams.length > 0) {
              streams = secondaryStreams;
            }
          } catch {
            // continue
          }
        }

        if (streams.length > 0) {
          const directStream = streams.find((s) => s.url && s.url.length > 0);
          const chosen = directStream || streams[0];
          setActiveStream(chosen);
        } else {
          setIsLoading(false);
          setPlaybackError(
            'Nessun flusso di riproduzione al momento disponibile per questo titolo. Riprova più tardi.'
          );
        }
      } catch (err: any) {
        if (isCancelled) return;
        setLoadingText('Attendi, cambio sorgente...');
        try {
          const streamTargetId = activeVideo?.id || media.id;
          const secondaryStreams = await stremioService.fetchSecondaryStreams(
            media.type,
            streamTargetId
          );
          if (isCancelled) return;
          if (secondaryStreams && secondaryStreams.length > 0) {
            const directStream = secondaryStreams.find((s) => s.url && s.url.length > 0);
            setActiveStream(directStream || secondaryStreams[0]);
            return;
          }
        } catch {
          // ignore
        }
        setIsLoading(false);
        setPlaybackError('Impossibile stabilire la connessione con la sorgente. Riprova più tardi.');
      }
    }

    if (!activeStream) {
      resolveStream();
    }

    return () => {
      isCancelled = true;
    };
  }, [media, activeVideo, activeStream]);

  // Mount Stream (Direct HLS / MP4 or Extractor)
  useEffect(() => {
    if (!activeStream) return;

    setIsLoading(true);
    setPlaybackError(null);
    setAudioTracks([]);
    setQualityLevels([]);

    // Save to watch history with full metadata and preserved subtitle settings
    hasResumedRef.current = false;
    stremioService.saveHistoryItem({
      id: media.id,
      type: media.type,
      name: media.name,
      poster: media.poster,
      background: media.background || (media as any).banner || (media as any).backdrop || media.poster,
      genres: media.genres,
      timestamp: Date.now(),
      streamName: activeStream.name,
      episodeTitle: activeVideo?.title,
      season: activeVideo?.season,
      episode: activeVideo?.episode,
      videoId: activeVideo?.id,
      subtitleUrl: selectedSubtitle,
    });

    // Fetch subtitles and restore preference if present
    const streamTargetId = activeVideo?.id || media.id;
    stremioService.fetchSubtitles(media.type, streamTargetId).then((subs) => {
      setSubtitles(subs);
      const savedSub = stremioService.getSavedSubtitlePreference(media.id, activeVideo?.id);
      if (savedSub && savedSub.url !== undefined) {
        setSelectedSubtitle(savedSub.url);
      }
    });

    // Direct stream (MP4 / HLS)
    if (activeStream.url && videoRef.current) {
      const resolvedUrl = getStreamProxyUrl(activeStream.url, activeStream);
      const isHls =
        resolvedUrl.includes('.m3u8') ||
        activeStream.url.includes('.m3u8') ||
        activeStream.name?.toLowerCase().includes('hls');

      if (isHls && Hls.isSupported()) {
        if (hlsRef.current) {
          hlsRef.current.destroy();
        }

        const targetTime = targetResumeTimeRef.current || stremioService.getSavedPlaybackTime(media.id, activeVideo?.id);

        const hls = new Hls({
          maxBufferLength: 25,
          maxMaxBufferLength: 50,
          enableWorker: true,
          lowLatencyMode: true,
          startFragPrefetch: true,
          capLevelToPlayerSize: true,
          startPosition: targetTime >= 1 ? targetTime : 1,
        });

        hls.loadSource(resolvedUrl);
        hls.attachMedia(videoRef.current);

        hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
          if (data.levels && data.levels.length > 0) {
            const lvls: QualityLevelInfo[] = data.levels.map((lvl, index) => ({
              id: index,
              height: lvl.height,
              bitrate: lvl.bitrate,
              name: lvl.height ? `${lvl.height}p` : `${Math.round(lvl.bitrate / 1000)}k`,
            }));
            setQualityLevels(lvls);
          }

          if (videoRef.current) {
            videoRef.current.muted = false;
            videoRef.current.volume = volume > 0 ? volume : 1;
          }
          setIsMuted(false);

          if (videoRef.current) {
            try {
              videoRef.current.currentTime = targetTime >= 1 ? targetTime : 1;
            } catch {}
          }

          const p = videoRef.current?.play();
          if (p !== undefined) {
            playPromiseRef.current = p;
            p.then(() => {
              if (playPromiseRef.current === p) playPromiseRef.current = null;
              setIsPlaying(true);
              setIsLoading(false);
              checkAndApplyResume();
            }).catch(() => {
              if (playPromiseRef.current === p) playPromiseRef.current = null;
              if (videoRef.current) {
                videoRef.current.muted = true;
                setIsMuted(true);
                const p2 = videoRef.current.play();
                if (p2 !== undefined) {
                  playPromiseRef.current = p2;
                  p2.then(() => {
                    if (playPromiseRef.current === p2) playPromiseRef.current = null;
                    setIsPlaying(true);
                    checkAndApplyResume();
                  }).catch(() => {
                    if (playPromiseRef.current === p2) playPromiseRef.current = null;
                  });
                }
              }
              setIsLoading(false);
            });
          }
        });

        hls.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_event, data) => {
          if (data.audioTracks && data.audioTracks.length > 0) {
            const tracks: AudioTrackInfo[] = data.audioTracks.map((t) => ({
              id: t.id,
              name: t.name,
              lang: t.lang,
            }));
            setAudioTracks(tracks);
            setSelectedAudioTrack(hls.audioTrack);
          }
        });

        hls.on(Hls.Events.AUDIO_TRACK_SWITCHED, (_event, data) => {
          setSelectedAudioTrack(data.id);
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
                if (isClosingRef.current || isTransitioningRef.current) {
                  return;
                }
                hls.destroy();
                setPlaybackError(
                  'Flusso momentaneamente non raggiungibile. Riprova più tardi.'
                );
                setIsLoading(false);
                break;
            }
          }
        });

        hlsRef.current = hls;
      } else {
        videoRef.current.src = resolvedUrl;
        const targetTime = targetResumeTimeRef.current || stremioService.getSavedPlaybackTime(media.id, activeVideo?.id);
        try {
          videoRef.current.currentTime = targetTime >= 1 ? targetTime : 1;
        } catch {}
        if (videoRef.current) {
          videoRef.current.muted = false;
          videoRef.current.volume = volume > 0 ? volume : 1;
        }
        setIsMuted(false);

        const p = videoRef.current.play();
        if (p !== undefined) {
          playPromiseRef.current = p;
          p.then(() => {
            if (playPromiseRef.current === p) playPromiseRef.current = null;
            setIsPlaying(true);
            setIsLoading(false);
            checkAndApplyResume();
          }).catch(() => {
            if (playPromiseRef.current === p) playPromiseRef.current = null;
            if (videoRef.current) {
              videoRef.current.muted = true;
              setIsMuted(true);
              const p2 = videoRef.current.play();
              if (p2 !== undefined) {
                playPromiseRef.current = p2;
                p2.then(() => {
                  if (playPromiseRef.current === p2) playPromiseRef.current = null;
                  setIsPlaying(true);
                  checkAndApplyResume();
                }).catch(() => {
                  if (playPromiseRef.current === p2) playPromiseRef.current = null;
                });
              }
            }
            setIsLoading(false);
          });
        }
      }
    } else if (activeStream.externalUrl) {
      setIsLoading(false);
    }

    return () => {
      if (!isTransitioningRef.current && videoRef.current && videoRef.current.currentTime > 5) {
        stremioService.savePlaybackProgress(
          media.id,
          videoRef.current.currentTime,
          videoRef.current.duration || 0,
          activeVideo?.id
        );
      }
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
      if (audioCtxRef.current) {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
    };
  }, [activeStream, media, activeVideo]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['input', 'textarea'].includes((e.target as HTMLElement)?.tagName?.toLowerCase())) return;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'arrowleft':
        case 'j':
          e.preventDefault();
          skipTime(-10);
          setRotateAnim('left');
          setTimeout(() => setRotateAnim(null), 300);
          break;
        case 'arrowright':
        case 'l':
          e.preventDefault();
          skipTime(10);
          setRotateAnim('right');
          setTimeout(() => setRotateAnim(null), 300);
          break;
        case 'arrowup':
          e.preventDefault();
          setVolume((v) => {
            const next = Math.min(1, v + 0.1);
            if (videoRef.current) videoRef.current.volume = next;
            return next;
          });
          break;
        case 'arrowdown':
          e.preventDefault();
          setVolume((v) => {
            const next = Math.max(0, v - 0.1);
            if (videoRef.current) videoRef.current.volume = next;
            return next;
          });
          break;
        case 'f':
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        case 'escape':
          handleFastClose();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isMuted, volume, duration]);

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setShowSettingsMenu(false);
      }
    }, 3500);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
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
  };

  const skipTime = (seconds: number) => {
    if (!videoRef.current) return;
    hasResumedRef.current = true;
    targetResumeTimeRef.current = 0;
    const dur = duration || videoRef.current.duration || 0;
    const nextT = Math.max(0, Math.min(dur, videoRef.current.currentTime + seconds));
    videoRef.current.currentTime = nextT;
    setCurrentTime(nextT);
    if (dur > 0) {
      lastProgressSaveRef.current = nextT;
      stremioService.savePlaybackProgress(media.id, nextT, dur, activeVideo?.id);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMute = !isMuted;
    videoRef.current.muted = newMute;
    setIsMuted(newMute);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const togglePiP = async () => {
    if (!videoRef.current) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch {
      // PiP
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleScrubberMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPosition(pos * 100);
    setHoverTime(pos * (duration || 0));
  };

  const handleScrubberMouseLeave = () => {
    setHoverTime(null);
  };

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const dur = duration || (videoRef.current?.duration || 0);
    const target = pos * dur;
    if (videoRef.current) {
      hasResumedRef.current = true;
      targetResumeTimeRef.current = 0;
      videoRef.current.currentTime = target;
      setCurrentTime(target);
      if (dur > 0) {
        lastProgressSaveRef.current = target;
        stremioService.savePlaybackProgress(media.id, target, dur, activeVideo?.id);
      }
    }
  };

  const isExtractorMode = !activeStream?.url && !!activeStream?.externalUrl;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onTouchStart={handleMouseMove}
      className="fixed inset-0 z-50 bg-black flex items-center justify-center select-none overflow-hidden"
    >
      {/* Video Display Container */}
      <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
        {isExtractorMode ? (
          <iframe
            src={activeStream?.externalUrl}
            title={media.name}
            className="w-full h-full border-0 bg-black"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            sandbox="allow-scripts allow-same-origin allow-forms allow-presentation"
          />
        ) : (
          <video
            ref={videoRef}
            onClick={togglePlay}
            onLoadedMetadata={() => {
              if (videoRef.current) {
                const newDur = videoRef.current.duration || 0;
                setDuration(newDur);
                if (isTransitioningRef.current) {
                  videoRef.current.currentTime = 1;
                  setCurrentTime(1);
                } else {
                  checkAndApplyResume();
                }
                setTimeout(() => {
                  isTransitioningRef.current = false;
                  hasAutoAdvancedRef.current = false;
                }, 2000);
              }
            }}
            onTimeUpdate={() => {
              if (videoRef.current) {
                const cur = videoRef.current.currentTime;
                const dur = videoRef.current.duration || 0;
                setCurrentTime(cur);
                setDuration(dur);

                // Reliable auto-advance to next episode ONLY when actively playing and reached end
                if (
                  isPlaying &&
                  !isTransitioningRef.current &&
                  media.type === 'series' &&
                  dur > 30 &&
                  cur > 20 &&
                  cur >= dur - 1.2 &&
                  !hasAutoAdvancedRef.current
                ) {
                  hasAutoAdvancedRef.current = true;
                  handlePlayNextEpisode();
                  return;
                }

                if (cur > 5 && Math.abs(cur - lastProgressSaveRef.current) >= 2.5) {
                  lastProgressSaveRef.current = cur;
                  stremioService.savePlaybackProgress(media.id, cur, dur, activeVideo?.id);
                }
              }
            }}
            onPause={() => {
              setIsPlaying(false);
              if (!isTransitioningRef.current && videoRef.current && videoRef.current.currentTime > 5) {
                stremioService.savePlaybackProgress(media.id, videoRef.current.currentTime, videoRef.current.duration || 0, activeVideo?.id);
              }
            }}
            onWaiting={() => setIsLoading(true)}
            onCanPlay={() => {
              setIsLoading(false);
              setPlaybackError(null);
              if (!hasResumedRef.current) {
                checkAndApplyResume();
              }
            }}
            onError={() => {
              if (isClosingRef.current || isTransitioningRef.current || !videoRef.current?.src) {
                return;
              }
              setIsLoading(false);
              setPlaybackError(
                'Impossibile riprodurre il flusso. Il server sorgente potrebbe essere temporaneamente occupato.'
              );
            }}
            onEnded={() => {
              setIsPlaying(false);
              if (!isTransitioningRef.current && media.type === 'series' && !hasAutoAdvancedRef.current) {
                hasAutoAdvancedRef.current = true;
                handlePlayNextEpisode();
              }
            }}
            className="w-full h-full cursor-pointer object-contain"
            autoPlay
            playsInline
            controls={false}
          />
        )}

        {/* High-visibility Custom Subtitles Overlay - Background adapts to text size */}
        {currentSubtitleText && (
          <div className="absolute bottom-12 sm:bottom-16 inset-x-0 flex justify-center px-4 pointer-events-none z-30">
            <div className="inline-block max-w-[92%] sm:max-w-4xl md:max-w-5xl px-4 sm:px-6 py-1.5 sm:py-2 rounded-2xl bg-black/80 text-white font-medium text-center text-sm sm:text-base md:text-lg border border-white/15 shadow-2xl backdrop-blur-md transition-all duration-150 leading-snug whitespace-pre-line drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
              {currentSubtitleText}
            </div>
          </div>
        )}
      </div>

      {/* Playback Error Modal */}
      {playbackError && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="max-w-md w-full liquid-glass-elevated rounded-3xl p-6 border border-amber-500/40 shadow-2xl space-y-4 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">Avviso di Riproduzione</h3>
              <p className="text-xs text-slate-300 leading-relaxed">{playbackError}</p>
            </div>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={handleFastClose}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all border border-white/20 cursor-pointer"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= TOP HUD BAR ================= */}
      <div
        className={`absolute top-0 left-0 right-0 p-3 sm:p-5 bg-gradient-to-b from-black/95 via-black/50 to-transparent transition-opacity duration-300 z-40 ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="w-full px-1 sm:px-3 flex items-center justify-between gap-4">
          {/* Left: Close X button (ultra-fast) + Title and Aligned Badge */}
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <button
              type="button"
              onClick={handleFastClose}
              className="w-10 h-10 rounded-2xl liquid-glass-transparent hover:bg-white/25 text-white flex items-center justify-center transition-all border border-white/25 cursor-pointer shadow-lg hover:scale-105 active:scale-95 flex-shrink-0"
              title="Esci dal player"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-black text-white truncate tracking-tight">
                  {media.name}
                </h1>
                <span
                  className={`px-2 py-0.5 rounded-md text-[10px] font-bold border flex-shrink-0 ${
                    media.type === 'series'
                      ? 'bg-purple-600/25 text-purple-300 border-purple-500/40 shadow-[0_0_12px_rgba(168,85,247,0.3)]'
                      : 'bg-red-600/25 text-rose-300 border-red-500/40 shadow-[0_0_12px_rgba(225,29,72,0.3)]'
                  }`}
                >
                  {media.type === 'series' ? 'Serie TV' : 'Film'}
                </span>
              </div>
              {activeVideo && (
                <div className="text-xs text-purple-300 font-semibold truncate mt-0.5">
                  Stagione {activeVideo.season || 1} • Episodio {activeVideo.episode || 1}
                </div>
              )}
            </div>
          </div>

          {/* Right: Volume Selector + Adatta/Riempi schermo + Fullscreen Square Button */}
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            {/* Selettore Volume con cursore e pallino bianco alla sinistra di Schermo Intero */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl liquid-glass-transparent border border-white/20 shadow-md">
              <button
                type="button"
                onClick={toggleMute}
                className="text-slate-200 hover:text-white transition-all cursor-pointer flex items-center justify-center"
                title="Audio (M)"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-red-400" />
                ) : volume < 0.5 ? (
                  <Volume1 className="w-4 h-4" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>

              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setVolume(v);
                  if (videoRef.current) {
                    try {
                      videoRef.current.volume = v;
                      videoRef.current.muted = false;
                    } catch {}
                  }
                  setIsMuted(false);
                }}
                className="w-16 sm:w-20 h-1 bg-white/25 rounded-lg appearance-none cursor-pointer accent-white"
              />
            </div>

            {/* Quadrato per ampliare / Schermo intero */}
            <button
              type="button"
              onClick={toggleFullscreen}
              className="w-10 h-10 rounded-2xl liquid-glass-transparent hover:bg-white/25 text-white flex items-center justify-center transition-all border border-white/25 cursor-pointer shadow-lg hover:scale-105 active:scale-95"
              title="Schermo intero (F)"
            >
              {isFullscreen ? (
                <Minimize className="w-4.5 h-4.5" />
              ) : (
                <Maximize className="w-4.5 h-4.5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ================= CENTER PLAYBACK CONTROLS ================= */}
      {!isExtractorMode && (
        <div
          className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-opacity duration-300 z-30 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="flex items-center gap-6 sm:gap-10 pointer-events-auto">
            {/* 10 secondi indietro (alla sua sinistra) - icona con animazione di rotazione */}
            <button
              type="button"
              onClick={() => {
                skipTime(-10);
                setRotateAnim('left');
                setTimeout(() => setRotateAnim(null), 300);
              }}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full liquid-glass-transparent hover:bg-white/25 text-white flex items-center justify-center transition-all cursor-pointer hover:scale-110 active:scale-95 border border-white/25 shadow-2xl backdrop-blur-xl"
              title="Riavvolgi 10 secondi"
            >
              <RotateCcw
                className={`w-6 h-6 sm:w-7 sm:h-7 transition-transform duration-300 ease-out ${
                  rotateAnim === 'left' ? '-rotate-35 scale-110 text-white' : 'rotate-0 scale-100 text-white'
                }`}
              />
            </button>

            {/* Play / Pausa (al centro) - Bolla trasparente senza rosso */}
            <button
              type="button"
              onClick={togglePlay}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full liquid-glass-transparent hover:bg-white/25 text-white flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.15)] transition-all hover:scale-110 active:scale-95 cursor-pointer border border-white/35 backdrop-blur-2xl"
              title={isPlaying ? 'Pausa (Spazio)' : 'Riproduci (Spazio)'}
            >
              {isPlaying ? (
                <Pause className="w-7 h-7 sm:w-9 sm:h-9 fill-current" />
              ) : (
                <Play className="w-7 h-7 sm:w-9 sm:h-9 fill-current ml-1" />
              )}
            </button>

            {/* 10 secondi avanti (alla sua destra) - icona con animazione di rotazione */}
            <button
              type="button"
              onClick={() => {
                skipTime(10);
                setRotateAnim('right');
                setTimeout(() => setRotateAnim(null), 300);
              }}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full liquid-glass-transparent hover:bg-white/25 text-white flex items-center justify-center transition-all cursor-pointer hover:scale-110 active:scale-95 border border-white/25 shadow-2xl backdrop-blur-xl"
              title="Avanza 10 secondi"
            >
              <RotateCw
                className={`w-6 h-6 sm:w-7 sm:h-7 transition-transform duration-300 ease-out ${
                  rotateAnim === 'right' ? 'rotate-35 scale-110 text-white' : 'rotate-0 scale-100 text-white'
                }`}
              />
            </button>
          </div>
        </div>
      )}

      {/* ================= BOTTOM FLOATING CONTROLS ================= */}
      {!isExtractorMode && (
        <div
          className={`absolute bottom-3 sm:bottom-5 inset-x-3 sm:inset-x-6 md:inset-x-8 z-40 transition-opacity duration-300 ${
            showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          <div className="liquid-glass-transparent rounded-2xl p-3 sm:p-4 border border-white/20 shadow-2xl backdrop-blur-2xl space-y-2.5">
            {/* Scrubber progress bar */}
            <div
              className="relative group/bar h-4 flex items-center cursor-pointer"
              onMouseMove={handleScrubberMouseMove}
              onMouseLeave={handleScrubberMouseLeave}
              onClick={handleScrubberClick}
            >
              <div className="w-full h-1.5 group-hover/bar:h-2.5 bg-white/20 rounded-full overflow-hidden transition-all duration-150 relative">
                <div
                  className="h-full bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.7)]"
                  style={{
                    width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                  }}
                />
              </div>

              {hoverTime !== null && (
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-white/80 pointer-events-none"
                  style={{ left: `${hoverPosition}%` }}
                />
              )}

              {hoverTime !== null && (
                <div
                  className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 rounded-md bg-slate-900/90 text-white text-[10px] font-mono font-bold border border-white/20 pointer-events-none shadow-lg backdrop-blur-md"
                  style={{ left: `${hoverPosition}%` }}
                >
                  {formatTime(hoverTime)}
                </div>
              )}
            </div>

            {/* Bottom Row: Minutaggio on Left, PiP and Rotellina Impostazioni on Right */}
            <div className="flex items-center justify-between">
              {/* Minutaggio / Tempo trascorso e totale */}
              <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-mono font-semibold text-slate-400">
                <span className="text-white font-bold">{formatTime(currentTime)}</span>
                <span className="text-slate-500">/</span>
                <span>{formatTime(duration)}</span>
              </div>

              {/* In basso a destra: Episodio Successivo (se serie), Picture-in-Picture e Rotellina Impostazioni */}
              <div className="flex items-center gap-2 relative">
                {/* Pulsante Episodio Successivo (per Serie TV) */}
                {media.type === 'series' && nextVideo && (
                  <button
                    type="button"
                    onClick={() => handlePlayNextEpisode(nextVideo)}
                    className="h-9 px-2.5 sm:px-3 rounded-xl liquid-glass-transparent hover:bg-purple-600/30 text-purple-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer border border-purple-500/30 shadow-md text-xs font-bold active:scale-95"
                    title={`Passa a Stagione ${nextVideo.season || 1} • Episodio ${nextVideo.episode || 1}`}
                  >
                    <SkipForward className="w-4 h-4 fill-purple-400 text-purple-400" />
                    <span className="hidden sm:inline">Prossimo</span>
                  </button>
                )}

                {/* Picture in Picture (alla sinistra delle impostazioni) */}
                <button
                  type="button"
                  onClick={togglePiP}
                  className="w-9 h-9 rounded-xl liquid-glass-transparent hover:bg-white/20 text-slate-200 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-white/20 shadow-md"
                  title="Picture in Picture"
                >
                  <PictureInPicture2 className="w-4 h-4" />
                </button>

                {/* Rotellina Impostazioni */}
                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsMenu((prev) => !prev);
                    setSettingsTab('root');
                  }}
                  className={`w-9 h-9 rounded-xl liquid-glass-transparent hover:bg-white/20 text-slate-200 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-white/20 shadow-md ${
                    showSettingsMenu ? 'bg-white/25 text-white ring-2 ring-rose-500/50' : ''
                  }`}
                  title="Impostazioni"
                >
                  <Settings className="w-4 h-4" />
                </button>

                {/* ================= DENTRO LA ROTELLINA: QUALITA, SOTTOTITOLI, LINGUA ================= */}
                {showSettingsMenu && (
                  <div className="absolute bottom-12 right-0 w-72 max-h-80 overflow-y-auto liquid-glass-elevated rounded-2xl p-3 border border-white/25 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-3xl bg-[#080812]/95 space-y-2">
                    {/* Header with back navigation if inside submenu */}
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      {settingsTab === 'root' ? (
                        <div className="flex items-center gap-2 text-xs font-bold text-white">
                          <Settings className="w-3.5 h-3.5 text-rose-400" />
                          <span>Impostazioni</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setSettingsTab('root')}
                          className="flex items-center gap-1.5 text-xs font-bold text-slate-300 hover:text-white cursor-pointer"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                          <span>Indietro</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowSettingsMenu(false)}
                        className="text-slate-400 hover:text-white p-1 rounded-lg"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* ROOT MENU: Qualità, Sottotitoli, Lingua */}
                    {settingsTab === 'root' && (
                      <div className="space-y-1">
                        {/* 1. Qualità */}
                        <button
                          type="button"
                          onClick={() => setSettingsTab('quality')}
                          className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <Sliders className="w-4 h-4 text-rose-400" />
                            <span>Qualità</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                            <span>
                              {selectedQuality === -1
                                ? 'Auto'
                                : qualityLevels.find((q) => q.id === selectedQuality)?.name || 'Auto'}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                          </div>
                        </button>

                        {/* 2. Sottotitoli */}
                        <button
                          type="button"
                          onClick={() => setSettingsTab('subtitles')}
                          className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <SubtitlesIcon className="w-4 h-4 text-cyan-400" />
                            <span>Sottotitoli</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-400">
                            <span className="truncate max-w-[100px]">
                              {selectedSubtitle ? 'Attivi' : 'Disattivati'}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                          </div>
                        </button>

                        {/* 3. Lingua (Audio) */}
                        <button
                          type="button"
                          onClick={() => setSettingsTab('audio')}
                          className="w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold text-slate-200 hover:bg-white/10 hover:text-white transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <Languages className="w-4 h-4 text-purple-400" />
                            <span>Lingua</span>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-slate-400">
                            <span className="truncate max-w-[100px]">
                              {audioTracks.find((a) => a.id === selectedAudioTrack)?.name || 'Default'}
                            </span>
                            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                          </div>
                        </button>
                      </div>
                    )}

                    {/* SUBMENU: QUALITA */}
                    {settingsTab === 'quality' && (
                      <div className="space-y-1 max-h-56 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectQuality(-1);
                            setShowSettingsMenu(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                            selectedQuality === -1
                              ? 'bg-rose-600/25 text-rose-300 border border-rose-500/40'
                              : 'text-slate-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span>Auto (Consigliata)</span>
                          {selectedQuality === -1 && <Check className="w-3.5 h-3.5 text-rose-400" />}
                        </button>

                        {qualityLevels.map((lvl) => {
                          const isSelected = selectedQuality === lvl.id;
                          return (
                            <button
                              type="button"
                              key={lvl.id}
                              onClick={() => {
                                handleSelectQuality(lvl.id);
                                setShowSettingsMenu(false);
                              }}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-rose-600/25 text-rose-300 border border-rose-500/40'
                                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              <span>{lvl.name}</span>
                              {isSelected && <Check className="w-3.5 h-3.5 text-rose-400" />}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* SUBMENU: SOTTOTITOLI */}
                    {settingsTab === 'subtitles' && (
                      <div className="space-y-1 max-h-56 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => {
                            handleSelectSubtitle(null);
                            setShowSettingsMenu(false);
                          }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                            selectedSubtitle === null
                              ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40'
                              : 'text-slate-300 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          <span>Disattivati</span>
                          {selectedSubtitle === null && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                        </button>

                        {subtitles.length > 0 ? (
                          subtitles.map((sub, idx) => {
                            const isSelected = selectedSubtitle === sub.url;
                            const label =
                              sub.label ||
                              (sub.lang === 'ita' || sub.lang === 'it'
                                ? 'Italiano'
                                : sub.lang === 'eng' || sub.lang === 'en'
                                ? 'Inglese'
                                : sub.lang?.toUpperCase() || `Traccia ${idx + 1}`);
                            return (
                              <button
                                type="button"
                                key={`${sub.id || sub.url}-${idx}`}
                                onClick={() => {
                                  handleSelectSubtitle(sub.url, sub.lang, sub.id);
                                  setShowSettingsMenu(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40'
                                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                <span className="truncate">{label}</span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 ml-2" />}
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-3 py-3 text-xs text-slate-400 text-center">
                            Nessun sottotitolo disponibile
                          </div>
                        )}
                      </div>
                    )}

                    {/* SUBMENU: LINGUA (AUDIO) */}
                    {settingsTab === 'audio' && (
                      <div className="space-y-1 max-h-56 overflow-y-auto">
                        {audioTracks.length > 0 ? (
                          audioTracks.map((track) => {
                            const isSelected = selectedAudioTrack === track.id;
                            return (
                              <button
                                type="button"
                                key={track.id}
                                onClick={() => {
                                  handleSelectAudioTrack(track.id);
                                  setShowSettingsMenu(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-purple-600/25 text-purple-300 border border-purple-500/40'
                                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                <span className="truncate">{track.name || `Traccia ${track.id + 1}`}</span>
                                {isSelected && <Check className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 ml-2" />}
                              </button>
                            );
                          })
                        ) : (
                          <div className="px-3 py-3 text-xs text-slate-400 text-center">
                            Traccia audio principale attiva
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ================= POPUP PROSSIMO EPISODIO NEGLI ULTIMI MINUTI ================= */}
      {showNextEpisodePrompt && nextVideo && (
        <div className="absolute bottom-28 sm:bottom-32 right-4 sm:right-8 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-auto">
          <div className="rounded-2xl p-2 sm:p-2.5 border border-purple-500/50 shadow-2xl flex items-center gap-2 bg-[#0d0d18] text-white">
            <button
              type="button"
              onClick={() => handlePlayNextEpisode(nextVideo)}
              className="py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-none cursor-pointer active:scale-95"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Passa al prossimo episodio</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const currentEpKey = activeVideo?.id || `${activeVideo?.season}:${activeVideo?.episode}`;
                setDismissedNextPrompt(currentEpKey);
                setShowNextEpisodePrompt(false);
              }}
              className="py-2.5 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white text-xs font-semibold transition-all cursor-pointer active:scale-95 border border-white/10"
            >
              Rimani qui
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
