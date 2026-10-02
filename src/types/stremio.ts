/**
 * Stremio v3 Add-on Protocol Types & Liquid Stremio interfaces
 */

export interface StremioManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  logo?: string;
  icon?: string;
  background?: string;
  types: string[]; // ['movie', 'series', 'anime', 'other', ...]
  resources: (string | { name: string; types?: string[]; idPrefixes?: string[] })[];
  catalogs: {
    type: string;
    id: string;
    name: string;
    extra?: {
      name: string;
      isRequired?: boolean;
      options?: string[];
      optionsLimit?: number;
    }[];
  }[];
  idPrefixes?: string[];
  behaviorHints?: {
    adult?: boolean;
    p2p?: boolean;
    configurable?: boolean;
    configurationRequired?: boolean;
  };
}

export interface StremioMetaPreview {
  id: string;
  type: 'movie' | 'series' | 'anime' | 'other' | string;
  name: string;
  poster?: string;
  posterShape?: 'poster' | 'landscape' | 'square';
  banner?: string;
  background?: string;
  logo?: string;
  genres?: string[];
  releaseInfo?: string;
  imdbRating?: string | number;
  description?: string;
  runtime?: string;
  year?: string | number;
}

export interface StremioVideo {
  id: string; // e.g. tt0944947:1:1
  title: string;
  name?: string;
  released?: string;
  season?: number;
  episode?: number;
  thumbnail?: string;
  overview?: string;
  description?: string;
  summary?: string;
  streams?: StremioStream[];
}

export interface StremioMetaDetail extends StremioMetaPreview {
  background?: string;
  cast?: string[];
  director?: string[];
  writer?: string[];
  awards?: string;
  country?: string;
  language?: string;
  tagline?: string;
  trailers?: { source: string; type: string }[];
  videos?: StremioVideo[];
  website?: string;
}

export interface StremioStream {
  name?: string; // e.g., "WebTorrent 1080p", "Cinemeta Direct"
  title?: string; // e.g., "1080p | 12 Seeds | 2.4 GB" or filename description
  infoHash?: string;
  fileIdx?: number;
  url?: string; // direct mp4 / hls / webm stream URL
  externalUrl?: string;
  ytId?: string; // YouTube video ID
  headers?: Record<string, string>;
  behaviorHints?: {
    notWebReady?: boolean;
    bingeGroup?: string;
    proxyHeaders?: Record<string, string> | { request?: Record<string, string> };
    videoHash?: string;
  };
}

export interface StremioSubtitle {
  id: string;
  url: string;
  lang: string;
  label?: string;
}

export interface InstalledAddon {
  id: string;
  name: string;
  version: string;
  description: string;
  transportUrl: string;
  manifest: StremioManifest;
  enabled: boolean;
  isOfficial?: boolean;
  icon?: string;
}

export interface WatchHistoryItem {
  id: string;
  type: string;
  name: string;
  poster?: string;
  background?: string;
  banner?: string;
  genres?: string[];
  timestamp: number;
  duration?: number;
  currentTime?: number;
  progress?: number;
  lastWatched: number;
  streamName?: string;
  videoId?: string;
  episodeTitle?: string;
  season?: number;
  episode?: number;
}

export type ViewTab = 'discover' | 'movies' | 'series' | 'library';
