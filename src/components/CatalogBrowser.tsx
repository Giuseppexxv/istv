import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Info,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Tv,
  Radio,
  Film,
  Star,
  Check,
  Plus,
} from 'lucide-react';
import {
  StremioMetaPreview,
  StremioMetaDetail,
  StremioStream,
  StremioVideo,
} from '../types/stremio';
import { stremioService } from '../services/stremioService';
import { MediaCard } from './MediaCard';
import { getReleaseYear } from '../utils/formatters';
import { optimizeImageUrl } from '../utils/imageOptimizer';
import { STREAMING_PROVIDERS } from './ProviderSelector';
import { Top10Row } from './Top10Row';
import { isAlreadyReleased, filterReleasedItems, rankFamousItems } from '../utils/releaseFilter';
import {
  fetchDiscoverCategories,
  fetchMovieCategories,
  fetchSeriesCategories,
  DiscoverCategoryRow,
} from '../services/dayNightCatalogService';
import {
  MOVIE_GENRE_DEFINITIONS,
  SERIES_GENRE_DEFINITIONS,
  GenreDefinition,
} from '../services/genreSubcategoryService';
import { CategoryCarouselBar } from './CategoryCarouselBar';
import { CategoryDetailView } from './CategoryDetailView';
import { getCategoryIconConfig } from '../utils/categoryIcons';
import { LiveTvBrowser } from './LiveTvBrowser';
import { LiveChannel } from '../services/liveTvService';

interface CatalogBrowserProps {
  tab: 'discover' | 'movies' | 'series' | 'livetv';
  searchQuery: string;
  onSearchChange?: (val: string) => void;
  onSelectMedia: (item: StremioMetaPreview) => void;
  onPlayStream: (media: StremioMetaDetail, stream?: StremioStream, video?: StremioVideo) => void;
  onPlayLiveChannel?: (channel: LiveChannel) => void;
}

// Italian to English mapping for Cinemeta catalog genres
const GENRE_IT_TO_EN: Record<string, string> = {
  'Azione': 'Action',
  'Commedia': 'Comedy',
  'Animazione': 'Animation',
  'Horror': 'Horror',
  'Fantascienza': 'Sci-Fi',
  'Thriller': 'Thriller',
  'Dramma': 'Drama',
  'Drammatico': 'Drama',
  'Avventura': 'Adventure',
  'Crime': 'Crime',
  'Crimine': 'Crime',
  'Documentario': 'Documentary',
  'Azione & Avventura': 'Action',
  'Fantascienza & Fantasy': 'Sci-Fi',
  'Famiglia': 'Family',
  'Mistero': 'Mystery',
  'Romantico': 'Romance',
  'Guerra': 'War',
  'Western': 'Western',
  'Fantasy': 'Fantasy',
  'Reality': 'Reality-TV',
};

// Module-level in-memory cache to preserve exact catalog view and avoid re-fetch latency
interface CatalogModuleCache {
  hasLoaded: boolean;
  selectedMovieGenre: string;
  selectedSeriesGenre: string;
  selectedMovieProvider: string;
  selectedSeriesProvider: string;
  providerCache: Record<string, { movies: StremioMetaPreview[]; series: StremioMetaPreview[] }>;
  discoverCategories: DiscoverCategoryRow[];
  movieCategories: DiscoverCategoryRow[];
  seriesCategories: DiscoverCategoryRow[];
  top10Movies: StremioMetaPreview[];
  top10Series: StremioMetaPreview[];
  nowPlaying: StremioMetaPreview[];
  trendingMovies: StremioMetaPreview[];
  trendingSeries: StremioMetaPreview[];
  popularMovies: StremioMetaPreview[];
  popularSeries: StremioMetaPreview[];
  topRatedMovies: StremioMetaPreview[];
  topRatedSeries: StremioMetaPreview[];
  netflixMovies: StremioMetaPreview[];
  primeMovies: StremioMetaPreview[];
  disneyMovies: StremioMetaPreview[];
  netflixSeries: StremioMetaPreview[];
  primeSeries: StremioMetaPreview[];
  comedyMovies: StremioMetaPreview[];
  actionMovies: StremioMetaPreview[];
  animationMovies: StremioMetaPreview[];
  horrorMovies: StremioMetaPreview[];
  sciFiMovies: StremioMetaPreview[];
  thrillerMovies: StremioMetaPreview[];
  dramaMovies: StremioMetaPreview[];
  crimeSeries: StremioMetaPreview[];
  comedySeries: StremioMetaPreview[];
  actionSeries: StremioMetaPreview[];
  sciFiSeries: StremioMetaPreview[];
  dramaSeries: StremioMetaPreview[];
  animeSeries: StremioMetaPreview[];
  docuSeries: StremioMetaPreview[];
  genreGridItems: StremioMetaPreview[];
  featuredList: StremioMetaPreview[];
  featuredIndex: number;
  seriesSubView: 'series' | 'livetv';
  scrollY: number;
}

const catalogCache: CatalogModuleCache = {
  hasLoaded: false,
  selectedMovieGenre: 'Tutti',
  selectedSeriesGenre: 'Tutti',
  seriesSubView: 'series',
  selectedMovieProvider: 'global',
  selectedSeriesProvider: 'global',
  providerCache: {},
  discoverCategories: [],
  movieCategories: [],
  seriesCategories: [],
  top10Movies: [],
  top10Series: [],
  nowPlaying: [],
  trendingMovies: [],
  trendingSeries: [],
  popularMovies: [],
  popularSeries: [],
  topRatedMovies: [],
  topRatedSeries: [],
  netflixMovies: [],
  primeMovies: [],
  disneyMovies: [],
  netflixSeries: [],
  primeSeries: [],
  comedyMovies: [],
  actionMovies: [],
  animationMovies: [],
  horrorMovies: [],
  sciFiMovies: [],
  thrillerMovies: [],
  dramaMovies: [],
  crimeSeries: [],
  comedySeries: [],
  actionSeries: [],
  sciFiSeries: [],
  dramaSeries: [],
  animeSeries: [],
  docuSeries: [],
  genreGridItems: [],
  featuredList: [],
  featuredIndex: 0,
  scrollY: 0,
};

// Immediate instant-render hydration from persistent cache (0ms start)
(() => {
  if (typeof window === 'undefined') return;
  try {
    const cachedT10M = stremioService.getCachedCatalog('topstreaming.italy', 'movie', 'popular-movie-global');
    const cachedT10S = stremioService.getCachedCatalog('topstreaming.italy', 'series', 'popular-series-global');
    if (cachedT10M && cachedT10M.length > 0) {
      catalogCache.top10Movies = cachedT10M;
      catalogCache.hasLoaded = true;
    }
    if (cachedT10S && cachedT10S.length > 0) {
      catalogCache.top10Series = cachedT10S;
      catalogCache.hasLoaded = true;
    }
    if (cachedT10M && cachedT10S && catalogCache.featuredList.length === 0) {
      catalogCache.featuredList = [...cachedT10M.slice(0, 4), ...cachedT10S.slice(0, 4)];
    }
    const savedDiscover = localStorage.getItem('istream_cat_all_v5');
    if (savedDiscover && catalogCache.discoverCategories.length === 0) {
      const parsed = JSON.parse(savedDiscover);
      if (Array.isArray(parsed) && parsed.length > 0) {
        catalogCache.discoverCategories = parsed;
      }
    }
    const savedMovies = localStorage.getItem('istream_cat_movie_v5');
    if (savedMovies && catalogCache.movieCategories.length === 0) {
      const parsed = JSON.parse(savedMovies);
      if (Array.isArray(parsed) && parsed.length > 0) {
        catalogCache.movieCategories = parsed;
      }
    }
    const savedSeries = localStorage.getItem('istream_cat_series_v5');
    if (savedSeries && catalogCache.seriesCategories.length === 0) {
      const parsed = JSON.parse(savedSeries);
      if (Array.isArray(parsed) && parsed.length > 0) {
        catalogCache.seriesCategories = parsed;
      }
    }
  } catch {}
})();

export const CatalogBrowser: React.FC<CatalogBrowserProps> = ({
  tab,
  searchQuery,
  onSelectMedia,
  onPlayStream,
  onPlayLiveChannel,
}) => {
  // Category filter state per tab (restored immediately from cache if available)
  const [selectedMovieGenre, setSelectedMovieGenre] = useState(catalogCache.selectedMovieGenre);
  const [selectedSeriesGenre, setSelectedSeriesGenre] = useState(catalogCache.selectedSeriesGenre);
  const [seriesSubView, setSeriesSubView] = useState<'series' | 'livetv'>(catalogCache.seriesSubView || 'series');

  // Dynamic Provider Top 10 selector state for Movies and Series (defaults to 'global')
  const [selectedMovieProvider, setSelectedMovieProvider] = useState<string>(catalogCache.selectedMovieProvider);
  const [selectedSeriesProvider, setSelectedSeriesProvider] = useState<string>(catalogCache.selectedSeriesProvider);
  const [providerCache, setProviderCache] = useState<
    Record<string, { movies: StremioMetaPreview[]; series: StremioMetaPreview[] }>
  >(catalogCache.providerCache);
  const [providerLoading, setProviderLoading] = useState<boolean>(false);

  // Shared / Discover / Movies / Series Categories
  const [discoverCategories, setDiscoverCategories] = useState<DiscoverCategoryRow[]>(catalogCache.discoverCategories);
  const [movieCategories, setMovieCategories] = useState<DiscoverCategoryRow[]>(catalogCache.movieCategories);
  const [seriesCategories, setSeriesCategories] = useState<DiscoverCategoryRow[]>(catalogCache.seriesCategories);
  const [categoriesLoading, setCategoriesLoading] = useState<boolean>(false);

  const [top10Movies, setTop10Movies] = useState<StremioMetaPreview[]>(catalogCache.top10Movies);
  const [top10Series, setTop10Series] = useState<StremioMetaPreview[]>(catalogCache.top10Series);
  const [nowPlaying, setNowPlaying] = useState<StremioMetaPreview[]>(catalogCache.nowPlaying);
  const [trendingMovies, setTrendingMovies] = useState<StremioMetaPreview[]>(catalogCache.trendingMovies);
  const [trendingSeries, setTrendingSeries] = useState<StremioMetaPreview[]>(catalogCache.trendingSeries);
  const [popularMovies, setPopularMovies] = useState<StremioMetaPreview[]>(catalogCache.popularMovies);
  const [popularSeries, setPopularSeries] = useState<StremioMetaPreview[]>(catalogCache.popularSeries);
  const [topRatedMovies, setTopRatedMovies] = useState<StremioMetaPreview[]>(catalogCache.topRatedMovies);
  const [topRatedSeries, setTopRatedSeries] = useState<StremioMetaPreview[]>(catalogCache.topRatedSeries);

  // Platform rows
  const [netflixMovies, setNetflixMovies] = useState<StremioMetaPreview[]>(catalogCache.netflixMovies);
  const [primeMovies, setPrimeMovies] = useState<StremioMetaPreview[]>(catalogCache.primeMovies);
  const [disneyMovies, setDisneyMovies] = useState<StremioMetaPreview[]>(catalogCache.disneyMovies);
  const [netflixSeries, setNetflixSeries] = useState<StremioMetaPreview[]>(catalogCache.netflixSeries);
  const [primeSeries, setPrimeSeries] = useState<StremioMetaPreview[]>(catalogCache.primeSeries);

  // Movie Genre Specific Rows
  const [comedyMovies, setComedyMovies] = useState<StremioMetaPreview[]>(catalogCache.comedyMovies);
  const [actionMovies, setActionMovies] = useState<StremioMetaPreview[]>(catalogCache.actionMovies);
  const [animationMovies, setAnimationMovies] = useState<StremioMetaPreview[]>(catalogCache.animationMovies);
  const [horrorMovies, setHorrorMovies] = useState<StremioMetaPreview[]>(catalogCache.horrorMovies);
  const [sciFiMovies, setSciFiMovies] = useState<StremioMetaPreview[]>(catalogCache.sciFiMovies);
  const [thrillerMovies, setThrillerMovies] = useState<StremioMetaPreview[]>(catalogCache.thrillerMovies);
  const [dramaMovies, setDramaMovies] = useState<StremioMetaPreview[]>(catalogCache.dramaMovies);

  // Series Genre Specific Rows
  const [crimeSeries, setCrimeSeries] = useState<StremioMetaPreview[]>(catalogCache.crimeSeries);
  const [comedySeries, setComedySeries] = useState<StremioMetaPreview[]>(catalogCache.comedySeries);
  const [actionSeries, setActionSeries] = useState<StremioMetaPreview[]>(catalogCache.actionSeries);
  const [sciFiSeries, setSciFiSeries] = useState<StremioMetaPreview[]>(catalogCache.sciFiSeries);
  const [dramaSeries, setDramaSeries] = useState<StremioMetaPreview[]>(catalogCache.dramaSeries);
  const [animeSeries, setAnimeSeries] = useState<StremioMetaPreview[]>(catalogCache.animeSeries);
  const [docuSeries, setDocuSeries] = useState<StremioMetaPreview[]>(catalogCache.docuSeries);

  // Filtered Genre Grid Results (when specific genre is picked)
  const [genreGridItems, setGenreGridItems] = useState<StremioMetaPreview[]>(catalogCache.genreGridItems);
  const [genreGridLoading, setGenreGridLoading] = useState(false);

  // Featured Hero Carousel
  const [featuredList, setFeaturedList] = useState<StremioMetaPreview[]>(catalogCache.featuredList);
  const [featuredIndex, setFeaturedIndex] = useState(catalogCache.featuredIndex);
  const [isHeroHovered, setIsHeroHovered] = useState(false);

  const [searchResults, setSearchResults] = useState<StremioMetaPreview[]>([]);
  const [loading, setLoading] = useState(!catalogCache.hasLoaded);
  const [searching, setSearching] = useState(false);

  // Sync state to memory cache
  useEffect(() => {
    catalogCache.selectedMovieGenre = selectedMovieGenre;
    catalogCache.selectedSeriesGenre = selectedSeriesGenre;
    catalogCache.seriesSubView = seriesSubView;
    catalogCache.selectedMovieProvider = selectedMovieProvider;
    catalogCache.selectedSeriesProvider = selectedSeriesProvider;
    catalogCache.providerCache = providerCache;
    catalogCache.discoverCategories = discoverCategories;
    catalogCache.movieCategories = movieCategories;
    catalogCache.seriesCategories = seriesCategories;
    catalogCache.top10Movies = top10Movies;
    catalogCache.top10Series = top10Series;
    catalogCache.nowPlaying = nowPlaying;
    catalogCache.trendingMovies = trendingMovies;
    catalogCache.trendingSeries = trendingSeries;
    catalogCache.popularMovies = popularMovies;
    catalogCache.popularSeries = popularSeries;
    catalogCache.topRatedMovies = topRatedMovies;
    catalogCache.topRatedSeries = topRatedSeries;
    catalogCache.netflixMovies = netflixMovies;
    catalogCache.primeMovies = primeMovies;
    catalogCache.disneyMovies = disneyMovies;
    catalogCache.netflixSeries = netflixSeries;
    catalogCache.primeSeries = primeSeries;
    catalogCache.comedyMovies = comedyMovies;
    catalogCache.actionMovies = actionMovies;
    catalogCache.animationMovies = animationMovies;
    catalogCache.horrorMovies = horrorMovies;
    catalogCache.sciFiMovies = sciFiMovies;
    catalogCache.thrillerMovies = thrillerMovies;
    catalogCache.dramaMovies = dramaMovies;
    catalogCache.crimeSeries = crimeSeries;
    catalogCache.comedySeries = comedySeries;
    catalogCache.actionSeries = actionSeries;
    catalogCache.sciFiSeries = sciFiSeries;
    catalogCache.dramaSeries = dramaSeries;
    catalogCache.animeSeries = animeSeries;
    catalogCache.docuSeries = docuSeries;
    catalogCache.genreGridItems = genreGridItems;
    catalogCache.featuredList = featuredList;
    catalogCache.featuredIndex = featuredIndex;
    if (discoverCategories.length > 0 || top10Movies.length > 0) {
      catalogCache.hasLoaded = true;
    }
  }, [
    selectedMovieGenre,
    selectedSeriesGenre,
    seriesSubView,
    selectedMovieProvider,
    selectedSeriesProvider,
    providerCache,
    discoverCategories,
    movieCategories,
    seriesCategories,
    top10Movies,
    top10Series,
    featuredList,
    featuredIndex,
  ]);

  // Preserve scroll position when entering/leaving playback
  useEffect(() => {
    if (catalogCache.scrollY > 0) {
      const savedY = catalogCache.scrollY;
      const t = setTimeout(() => {
        window.scrollTo({ top: savedY, behavior: 'instant' });
      }, 50);
      return () => {
        clearTimeout(t);
        catalogCache.scrollY = window.scrollY;
      };
    }

    return () => {
      catalogCache.scrollY = window.scrollY;
    };
  }, []);

  // Auto advance featured hero carousel every 5 seconds (zero CPU loop when tab is backgrounded)
  useEffect(() => {
    if (featuredList.length <= 1) return;
    if (isHeroHovered) return;

    let timer: NodeJS.Timeout | null = null;

    const startTimer = () => {
      if (!timer && !document.hidden) {
        timer = setInterval(() => {
          setFeaturedIndex((current) => (current + 1) % featuredList.length);
        }, 5000);
      }
    };

    const stopTimer = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopTimer();
      } else {
        startTimer();
      }
    };

    startTimer();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [featuredList.length, isHeroHovered]);

  // Load Primary Catalogs based on Active Tab
  useEffect(() => {
    loadPrimaryData();
    setFeaturedIndex(0);
  }, [tab]);

  // Load Filtered Grid when a single genre is selected in Movies or Series
  useEffect(() => {
    if (tab === 'movies' && selectedMovieGenre !== 'Tutti') {
      loadSpecificGenre('movie', selectedMovieGenre);
    } else if (tab === 'series' && selectedSeriesGenre !== 'Tutti') {
      loadSpecificGenre('series', selectedSeriesGenre);
    }
  }, [tab, selectedMovieGenre, selectedSeriesGenre]);

  // Search handling
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const delayDebounce = setTimeout(() => {
      const q = searchQuery.trim();
      // Global search across both movies and series regardless of active tab
      Promise.all([
        stremioService.fetchCatalog('official.catalog', 'movie', 'top', { search: q }),
        stremioService.fetchCatalog('official.catalog', 'series', 'top', { search: q }),
      ])
        .then(([mov, ser]) => {
          const combined = [...(mov || []), ...(ser || [])];
          const seen = new Set<string>();
          const unique = combined.filter((it) => {
            if (!it || !it.id || seen.has(it.id)) return false;
            if (!isAlreadyReleased(it)) return false;
            seen.add(it.id);
            return true;
          });
          setSearchResults(rankFamousItems(unique, q));
          setSearching(false);
        })
        .catch(() => setSearching(false));
    }, 250);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  const loadSpecificGenre = async (type: 'movie' | 'series', genre: string) => {
    setGenreGridLoading(true);
    try {
      const cinemetaGenre = GENRE_IT_TO_EN[genre] || genre;
      const fetchPromises: Promise<StremioMetaPreview[]>[] = [
        stremioService.fetchCatalog('official.catalog', type, 'top', { genre: cinemetaGenre }),
        stremioService.fetchCatalog('official.catalog', type, 'top', { genre: cinemetaGenre, skip: 50 }).catch(() => []),
        stremioService.fetchCatalog('official.catalog', type, 'top', { genre: cinemetaGenre, skip: 100 }).catch(() => []),
      ];

      // Enrich with superhero and blockbuster titles if relevant
      if (['Azione', 'Fantascienza', 'Azione & Avventura', 'Fantascienza & Fantasy', 'Animazione'].includes(genre)) {
        fetchPromises.push(
          stremioService.fetchCatalog('official.catalog', type, 'top', { search: 'spider-man' }).catch(() => []),
          stremioService.fetchCatalog('official.catalog', type, 'top', { search: 'batman' }).catch(() => []),
          stremioService.fetchCatalog('official.catalog', type, 'top', { search: 'avengers' }).catch(() => []),
          stremioService.fetchCatalog('official.catalog', type, 'top', { search: type === 'movie' ? 'deadpool' : 'the boys' }).catch(() => [])
        );
      }

      const results = await Promise.all(fetchPromises);
      const combined = results.flat();
      const seen = new Set<string>();
      const deduped = combined.filter((it) => {
        if (!it || !it.id || seen.has(it.id)) return false;
        seen.add(it.id);
        return true;
      });
      setGenreGridItems(filterReleasedItems(deduped));
    } catch (e) {
      console.warn('Failed to load genre items', e);
    } finally {
      setGenreGridLoading(false);
    }
  };

  const setAndEnrichFeaturedList = (items: StremioMetaPreview[]) => {
    const releasedOnly = filterReleasedItems(items);
    setFeaturedList(releasedOnly);
    // Fetch detailed meta in background to obtain transparent official logo if available
    Promise.all(
      releasedOnly.slice(0, 8).map(async (item) => {
        try {
          const meta = await stremioService.fetchMeta(item.type, item.id);
          if (meta && meta.logo) {
            return { ...item, logo: meta.logo };
          }
        } catch {
          // ignore
        }
        return item;
      })
    ).then((enriched) => {
      setFeaturedList(enriched);
    }).catch(() => {});
  };

  const fetchProviderTop10 = async (providerId: string) => {
    if (
      providerCache[providerId] &&
      (providerCache[providerId].movies.length > 0 || providerCache[providerId].series.length > 0)
    ) {
      return providerCache[providerId];
    }

    const config =
      STREAMING_PROVIDERS.find((p) => p.id === providerId) || STREAMING_PROVIDERS[0];
    setProviderLoading(true);

    try {
      const [movies, series] = await Promise.all([
        stremioService.fetchCatalog('topstreaming.italy', 'movie', config.movieCatalogId),
        stremioService.fetchCatalog('topstreaming.italy', 'series', config.seriesCatalogId),
      ]);

      const data = {
        movies,
        series,
      };

      setProviderCache((prev) => ({ ...prev, [providerId]: data }));
      return data;
    } catch (e) {
      console.warn(`Failed to fetch provider top 10 for ${providerId}`, e);
      return { movies: [], series: [] };
    } finally {
      setProviderLoading(false);
    }
  };

  const handleSelectMovieProvider = (providerId: string) => {
    setSelectedMovieProvider(providerId);
    fetchProviderTop10(providerId);
  };

  const handleSelectSeriesProvider = (providerId: string) => {
    setSelectedSeriesProvider(providerId);
    fetchProviderTop10(providerId);
  };

  useEffect(() => {
    if (selectedMovieProvider !== 'global') {
      fetchProviderTop10(selectedMovieProvider);
    }
  }, [selectedMovieProvider]);

  useEffect(() => {
    if (selectedSeriesProvider !== 'global') {
      fetchProviderTop10(selectedSeriesProvider);
    }
  }, [selectedSeriesProvider]);

  // Load Categories per tab (Discover = 50/50, Movies = 100% movies, Series = 100% series)
  useEffect(() => {
    let isMounted = true;
    if (tab === 'discover') {
      if (discoverCategories.length === 0) setCategoriesLoading(true);
      fetchDiscoverCategories()
        .then((cats) => {
          if (isMounted) {
            setDiscoverCategories(cats);
            setCategoriesLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) setCategoriesLoading(false);
        });
    } else if (tab === 'movies') {
      if (movieCategories.length === 0) setCategoriesLoading(true);
      fetchMovieCategories()
        .then((cats) => {
          if (isMounted) {
            setMovieCategories(cats);
            setCategoriesLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) setCategoriesLoading(false);
        });
    } else if (tab === 'series') {
      if (seriesCategories.length === 0) setCategoriesLoading(true);
      fetchSeriesCategories()
        .then((cats) => {
          if (isMounted) {
            setSeriesCategories(cats);
            setCategoriesLoading(false);
          }
        })
        .catch(() => {
          if (isMounted) setCategoriesLoading(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [tab]);

  const loadPrimaryData = async () => {
    if (!catalogCache.hasLoaded) {
      setLoading(true);
    }

    try {
      if (tab === 'discover') {
        // Fast-path 1: Fetch Top 10 first to render Hero banner and top rows immediately (< 200ms)
        const [t10m, t10s] = await Promise.all([
          stremioService.fetchCatalog('topstreaming.italy', 'movie', 'popular-movie-global'),
          stremioService.fetchCatalog('topstreaming.italy', 'series', 'popular-series-global'),
        ]);

        if (t10m.length > 0) setTop10Movies(t10m);
        if (t10s.length > 0) setTop10Series(t10s);
        setLoading(false);

        const combined = [...t10m.slice(0, 4), ...t10s.slice(0, 4)].filter(Boolean);
        if (combined.length > 0) {
          setAndEnrichFeaturedList(combined);
        }

        // Fast-path 2: Load platform rows progressively in the background without blocking the UI
        Promise.all([
          stremioService.fetchCatalog('official.catalog', 'movie', 'top'),
          stremioService.fetchCatalog('official.catalog', 'series', 'top'),
          stremioService.fetchCatalog('official.catalog', 'movie', 'imdbRating'),
          stremioService.fetchCatalog('topstreaming.italy', 'movie', 'netflix-movies-italy'),
          stremioService.fetchCatalog('topstreaming.italy', 'series', 'netflix-series-italy'),
          stremioService.fetchCatalog('topstreaming.italy', 'movie', 'amazon-prime-movies-italy'),
          stremioService.fetchCatalog('topstreaming.italy', 'movie', 'disney-movies-italy'),
        ]).then(([trendM, trendS, topM, netM, netS, primeM, disM]) => {
          if (trendM.length > 0) {
            setTrendingMovies(trendM);
            setNowPlaying(trendM);
          }
          if (trendS.length > 0) setTrendingSeries(trendS);
          if (topM.length > 0) setTopRatedMovies(topM);
          if (netM.length > 0) setNetflixMovies(netM);
          if (netS.length > 0) setNetflixSeries(netS);
          if (primeM.length > 0) setPrimeMovies(primeM);
          if (disM.length > 0) setDisneyMovies(disM);

          setProviderCache((prev) => ({
            ...prev,
            global: { movies: t10m.slice(0, 10), series: t10s.slice(0, 10) },
            netflix: { movies: netM.slice(0, 10), series: netS.slice(0, 10) },
          }));
        }).catch(() => {});
      } else if (tab === 'movies') {
        // Fast-path 1: Fetch Movie Top 10 first to render immediately
        const t10m = await stremioService.fetchCatalog('topstreaming.italy', 'movie', 'popular-movie-global');
        if (t10m.length > 0) {
          setTop10Movies(t10m);
          setAndEnrichFeaturedList(t10m.slice(0, 8));
          setLoading(false);
        }

        // Fast-path 2: Load secondary movies in the background progressively
        Promise.all([
          stremioService.fetchCatalog('official.catalog', 'movie', 'top'),
          stremioService.fetchCatalog('official.catalog', 'movie', 'imdbRating'),
          stremioService.fetchCatalog('topstreaming.italy', 'movie', 'netflix-movies-italy'),
          stremioService.fetchCatalog('topstreaming.italy', 'movie', 'amazon-prime-movies-italy'),
          stremioService.fetchCatalog('topstreaming.italy', 'movie', 'disney-movies-italy'),
        ]).then(([popM, topM, netM, primeM, disM]) => {
          if (popM.length > 0) {
            setPopularMovies(popM);
            setTrendingMovies(popM);
            setNowPlaying(popM);
          }
          if (topM.length > 0) setTopRatedMovies(topM);
          if (netM.length > 0) setNetflixMovies(netM);
          if (primeM.length > 0) setPrimeMovies(primeM);
          if (disM.length > 0) setDisneyMovies(disM);
        }).catch(() => {});

        // Fast-path 3: Genre rows loaded in the background
        Promise.all([
          stremioService.fetchCatalog('official.catalog', 'movie', 'top', { genre: 'Comedy' }),
          stremioService.fetchCatalog('official.catalog', 'movie', 'top', { genre: 'Action' }),
          stremioService.fetchCatalog('official.catalog', 'movie', 'top', { genre: 'Animation' }),
          stremioService.fetchCatalog('official.catalog', 'movie', 'top', { genre: 'Horror' }),
          stremioService.fetchCatalog('official.catalog', 'movie', 'top', { genre: 'Sci-Fi' }),
          stremioService.fetchCatalog('official.catalog', 'movie', 'top', { genre: 'Thriller' }),
          stremioService.fetchCatalog('official.catalog', 'movie', 'top', { genre: 'Drama' }),
        ]).then(([comedy, action, anim, horror, scifi, thriller, drama]) => {
          if (comedy.length > 0) setComedyMovies(comedy);
          if (action.length > 0) setActionMovies(action);
          if (anim.length > 0) setAnimationMovies(anim);
          if (horror.length > 0) setHorrorMovies(horror);
          if (scifi.length > 0) setSciFiMovies(scifi);
          if (thriller.length > 0) setThrillerMovies(thriller);
          if (drama.length > 0) setDramaMovies(drama);
        }).catch(() => {});
      } else if (tab === 'series') {
        // Fast-path 1: Fetch Series Top 10 first to render immediately
        const t10s = await stremioService.fetchCatalog('topstreaming.italy', 'series', 'popular-series-global');
        if (t10s.length > 0) {
          setTop10Series(t10s);
          setAndEnrichFeaturedList(t10s.slice(0, 8));
          setLoading(false);
        }

        // Fast-path 2: Load secondary series in the background progressively
        Promise.all([
          stremioService.fetchCatalog('official.catalog', 'series', 'top'),
          stremioService.fetchCatalog('official.catalog', 'series', 'imdbRating'),
          stremioService.fetchCatalog('topstreaming.italy', 'series', 'netflix-series-italy'),
          stremioService.fetchCatalog('topstreaming.italy', 'series', 'amazon-prime-series-italy'),
        ]).then(([popS, topS, netS, primeS]) => {
          if (popS.length > 0) {
            setPopularSeries(popS);
            setTrendingSeries(popS);
          }
          if (topS.length > 0) setTopRatedSeries(topS);
          if (netS.length > 0) setNetflixSeries(netS);
          if (primeS.length > 0) setPrimeSeries(primeS);
        }).catch(() => {});

        // Fast-path 3: Genre series loaded in the background
        Promise.all([
          stremioService.fetchCatalog('official.catalog', 'series', 'top', { genre: 'Crime' }),
          stremioService.fetchCatalog('official.catalog', 'series', 'top', { genre: 'Comedy' }),
          stremioService.fetchCatalog('official.catalog', 'series', 'top', { genre: 'Action' }),
          stremioService.fetchCatalog('official.catalog', 'series', 'top', { genre: 'Sci-Fi' }),
          stremioService.fetchCatalog('official.catalog', 'series', 'top', { genre: 'Drama' }),
          stremioService.fetchCatalog('official.catalog', 'series', 'top', { genre: 'Animation' }),
          stremioService.fetchCatalog('official.catalog', 'series', 'top', { genre: 'Documentary' }),
        ]).then(([crime, comedy, action, scifi, drama, anime, docu]) => {
          if (crime.length > 0) setCrimeSeries(crime);
          if (comedy.length > 0) setComedySeries(comedy);
          if (action.length > 0) setActionSeries(action);
          if (scifi.length > 0) setSciFiSeries(scifi);
          if (drama.length > 0) setDramaSeries(drama);
          if (anime.length > 0) setAnimeSeries(anime);
          if (docu.length > 0) setDocuSeries(docu);
        }).catch(() => {});
      }
    } catch (e) {
      console.warn('Error loading catalog rows', e);
    } finally {
      setLoading(false);
    }
  };

  const currentHero = featuredList[featuredIndex] || null;
  const [heroInLibrary, setHeroInLibrary] = useState(false);

  useEffect(() => {
    if (currentHero) {
      setHeroInLibrary(stremioService.isInLibrary(currentHero.id));
    }

    const handleLibraryUpdate = () => {
      if (currentHero) {
        setHeroInLibrary(stremioService.isInLibrary(currentHero.id));
      }
    };

    window.addEventListener('stremio_library_changed', handleLibraryUpdate);
    window.addEventListener('storage', handleLibraryUpdate);
    return () => {
      window.removeEventListener('stremio_library_changed', handleLibraryUpdate);
      window.removeEventListener('storage', handleLibraryUpdate);
    };
  }, [currentHero?.id]);

  const handleHeroLibraryToggle = () => {
    if (!currentHero) return;
    const state = stremioService.toggleLibraryItem(currentHero);
    setHeroInLibrary(state);
  };

  const handleHeroPlay = () => {
    if (!currentHero) return;
    onPlayStream(currentHero as StremioMetaDetail);
  };

  const handleSelectHeroSlide = (idx: number) => {
    setFeaturedIndex(idx);
  };

  const handlePrevHero = () => {
    if (featuredList.length <= 1) return;
    setFeaturedIndex((prev) => (prev === 0 ? featuredList.length - 1 : prev - 1));
  };

  const handleNextHero = () => {
    if (featuredList.length <= 1) return;
    setFeaturedIndex((prev) => (prev + 1) % featuredList.length);
  };

  const handleCardQuickPlay = React.useCallback((m: StremioMetaPreview) => {
    onSelectMedia(m);
  }, [onSelectMedia]);

  const movieProviderData = providerCache[selectedMovieProvider];
  const providerTop10Movies =
    movieProviderData && movieProviderData.movies.length > 0
      ? movieProviderData.movies
      : selectedMovieProvider === 'global'
      ? top10Movies
      : netflixMovies;

  const seriesProviderData = providerCache[selectedSeriesProvider];
  const providerTop10Series =
    seriesProviderData && seriesProviderData.series.length > 0
      ? seriesProviderData.series
      : selectedSeriesProvider === 'global'
      ? top10Series
      : netflixSeries;

  // Search Results View
  if (searchQuery.trim()) {
    return (
      <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16 pt-24 sm:pt-28 pb-12 space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span>Risultati per "{searchQuery}"</span>
            <span className="text-xs text-slate-400 font-normal">
              ({searchResults.length} trovati)
            </span>
          </h2>
          {searching && <Loader2 className="w-5 h-5 text-rose-500 animate-spin" />}
        </div>

        {searchResults.length === 0 && !searching ? (
          <div className="p-16 rounded-3xl liquid-glass text-center text-slate-400 space-y-2">
            <Film className="w-10 h-10 mx-auto text-slate-600" />
            <p className="text-sm font-medium">Nessun titolo trovato nel catalogo.</p>
            <p className="text-xs text-slate-500">
              Prova con una parola chiave differente o cerca per genere.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-5 pt-3.5 pb-4">
            {searchResults.map((item, idx) => (
              <MediaCard
                key={`${item.id}-${idx}`}
                item={item}
                onSelect={onSelectMedia}
                onQuickPlay={handleCardQuickPlay}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-10 pb-20 bg-black min-h-screen">
      {/* ==================== FEATURED HERO CAROUSEL ==================== */}
      {currentHero && (
        <div
          className="relative w-full min-h-[72vh] sm:min-h-[88vh] md:min-h-[92vh] flex items-end pt-28 sm:pt-32 pb-16 landscape:pb-12 sm:pb-16 select-none overflow-hidden"
          onMouseEnter={() => setIsHeroHovered(true)}
          onMouseLeave={() => setIsHeroHovered(false)}
        >
          {/* Full Screen Cinematic Backdrop (Poster for mobile portrait starting at middle of navbar selector, Background banner for desktop/landscape) */}
          <div className="absolute inset-0 top-7 sm:top-0 overflow-hidden">
            <img
              key={currentHero.id}
              src={
                (typeof window !== 'undefined' && window.innerWidth < 640
                  ? optimizeImageUrl(currentHero.poster, 'poster') || optimizeImageUrl(currentHero.background, 'background')
                  : optimizeImageUrl(currentHero.background, 'background') || optimizeImageUrl(currentHero.poster, 'poster')) ||
                'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1920&q=85'
              }
              alt={currentHero.name}
              className="w-full h-full object-cover object-center filter brightness-100 contrast-110 saturate-140 transition-all duration-1000 ease-out"
            />
            
            {/* Top black gradient diffusion */}
            <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black via-black/70 to-transparent pointer-events-none z-10" />

            {/* Multilayer Dark Gradients for Liquid Transparency & AMOLED Seamless Fade */}
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/40 to-transparent sm:w-3/4" />
            <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-black via-black/85 to-transparent pointer-events-none" />
          </div>

          {/* Hero Main Content Row */}
          <div className="relative z-10 w-full px-4 sm:px-8 md:px-12 lg:px-16">
            <div className="max-w-2xl sm:max-w-3xl space-y-3.5">
              {/* Tipo Badge in alto */}
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span
                  className={`px-3 py-1 rounded-full liquid-glass-transparent text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-md ${
                    currentHero.type === 'movie'
                      ? 'text-rose-300 border border-rose-500/35'
                      : 'text-purple-300 border border-purple-500/35'
                  }`}
                >
                  {currentHero.type === 'movie' ? (
                    <Film className="w-3 h-3 text-rose-400" />
                  ) : (
                    <Tv className="w-3 h-3 text-purple-400" />
                  )}
                  <span>{currentHero.type === 'movie' ? 'Film' : 'Serie TV'}</span>
                </span>
              </div>

              {/* Title / Poster Logo & Content block (shifted further lower on mobile portrait) */}
              <div className="pt-14 sm:pt-0 space-y-3 sm:space-y-3.5">
                {currentHero.logo ? (
                  <div className="py-1">
                    <img
                      src={currentHero.logo}
                      alt={currentHero.name}
                      className="h-16 sm:h-24 md:h-32 max-w-[85vw] sm:max-w-xl object-contain object-left drop-shadow-[0_10px_25px_rgba(0,0,0,0.95)]"
                    />
                  </div>
                ) : (
                  <h1 className="font-poster-logo text-3xl sm:text-6xl md:text-7xl font-black tracking-tighter drop-shadow-[0_8px_30px_rgba(0,0,0,0.95)] uppercase leading-none">
                    {currentHero.name}
                  </h1>
                )}

                {/* Valutazione, Anno, Categoria */}
                <div className="flex items-center gap-2.5 flex-wrap text-xs pt-0.5">
                  {/* Valutazione */}
                  {currentHero.imdbRating && (
                    <span className="flex items-center gap-1 text-[11px] text-amber-300 bg-amber-500/20 px-3 py-1 rounded-full border border-amber-500/35 font-bold shadow-md">
                      <Star className="w-3 h-3 fill-amber-400" />
                      <span>{currentHero.imdbRating}</span>
                    </span>
                  )}

                  {/* Anno */}
                  {currentHero.releaseInfo && (
                    <span className="text-[11px] font-semibold text-slate-200 liquid-glass-transparent px-3 py-1 rounded-full border border-white/25 shadow-md">
                      {getReleaseYear(currentHero.releaseInfo)}
                    </span>
                  )}

                  {/* Categoria / Genere */}
                  {currentHero.genres && currentHero.genres.length > 0 && (
                    <span className="text-[11px] font-medium text-slate-300 liquid-glass-transparent px-3 py-1 rounded-full border border-white/20 shadow-md">
                      {currentHero.genres.slice(0, 3).join(' • ')}
                    </span>
                  )}
                </div>

                {currentHero.description && (
                  <p className="text-xs sm:text-base text-slate-200/90 line-clamp-2 sm:line-clamp-3 leading-relaxed max-w-2xl font-normal drop-shadow-md">
                    {currentHero.description}
                  </p>
                )}

                {/* Action Buttons: Episodi / Guarda Ora, Aggiungi alla Libreria, Scheda & Trama (All Horizontal) */}
                <div className="flex items-center gap-2 sm:gap-3.5 pt-1.5 flex-nowrap sm:flex-wrap overflow-x-auto scrollbar-none pb-1 pr-36 landscape:pr-48 sm:pr-0 max-w-full">
                  {currentHero.type === 'series' ? (
                    <button
                      onClick={() => onSelectMedia(currentHero)}
                      className="flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm tracking-wide transition-all duration-200 shadow-xl active:scale-95 cursor-pointer whitespace-nowrap flex-shrink-0"
                    >
                      <Tv className="w-4 h-4 text-white" />
                      <span>Episodi</span>
                    </button>
                  ) : (
                    <button
                      onClick={handleHeroPlay}
                      className="flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-3.5 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white font-black text-xs sm:text-sm tracking-wide transition-all duration-200 shadow-xl active:scale-95 cursor-pointer whitespace-nowrap flex-shrink-0"
                    >
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                      <span>Guarda Ora</span>
                    </button>
                  )}

                  <button
                    onClick={handleHeroLibraryToggle}
                    className={`flex items-center gap-2 px-3.5 sm:px-5 py-3 sm:py-3.5 rounded-2xl font-bold text-xs sm:text-sm transition-all duration-200 cursor-pointer shadow-lg active:scale-95 whitespace-nowrap flex-shrink-0 ${
                      heroInLibrary
                        ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 shadow-emerald-500/20'
                        : 'liquid-glass-transparent hover:bg-white/20 text-white border border-white/25'
                    }`}
                    title={heroInLibrary ? 'Rimuovi dalla Libreria' : 'Aggiungi alla Libreria'}
                  >
                    {heroInLibrary ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    <span className="hidden landscape:inline sm:inline">
                      {heroInLibrary ? 'In Libreria' : 'Aggiungi alla Libreria'}
                    </span>
                  </button>

                  <button
                    onClick={() => onSelectMedia(currentHero)}
                    className="flex items-center gap-2 px-3.5 sm:px-5 py-3 sm:py-3.5 rounded-2xl liquid-glass-transparent hover:bg-white/20 text-slate-200 hover:text-white font-semibold text-xs sm:text-sm transition-all duration-200 active:scale-95 cursor-pointer border border-white/25 shadow-lg whitespace-nowrap flex-shrink-0"
                    title="Scheda & Trama"
                  >
                    <Info className="w-4 h-4 text-rose-300" />
                    <span className="hidden landscape:inline sm:inline">Scheda & Trama</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Carousel Controller Pill: Positioned cleanly inside banner without translate overflow clipping */}
          {featuredList.length > 1 && (
            <div className="absolute bottom-3 sm:bottom-5 right-3 sm:right-8 z-20 pointer-events-auto">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full liquid-glass-transparent border border-white/30 shadow-2xl backdrop-blur-xl">
                <button
                  type="button"
                  onClick={handlePrevHero}
                  className="w-7 h-7 rounded-full text-white/90 hover:text-white hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                  title="Precedente"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <div className="flex items-center gap-1.5 px-1">
                  {featuredList.map((item, idx) => {
                    const isCurrent = idx === featuredIndex;
                    return (
                      <button
                        key={`${item.id}-${idx}`}
                        onClick={() => handleSelectHeroSlide(idx)}
                        className={`relative h-1.5 sm:h-2 rounded-full transition-all duration-300 cursor-pointer overflow-hidden ${
                          isCurrent ? 'w-6 sm:w-10 bg-white/30' : 'w-1.5 sm:w-2 bg-white/30 hover:bg-white/60'
                        }`}
                        title={`Slide ${idx + 1}`}
                      >
                        {isCurrent && (
                          <div
                            key={`hero-bar-${featuredIndex}`}
                            className={`absolute inset-y-0 left-0 bg-gradient-to-r from-red-600 via-rose-500 to-red-500 rounded-full shadow-[0_0_8px_rgba(225,29,72,0.8)] ${
                              isHeroHovered ? 'w-full' : 'animate-hero-progress'
                            }`}
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={handleNextHero}
                  className="w-7 h-7 rounded-full text-white/90 hover:text-white hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                  title="Successivo"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AMOLED Black transition spacer */}
      <div className="h-2 max-sm:h-6 max-sm:landscape:h-8" />

      {/* MAIN CATALOG CONTENT */}
      <div className="w-full px-4 sm:px-8 md:px-12 lg:px-16 space-y-10">
        {/* ==================== TAB 1: SCOPRI (DISCOVER) ==================== */}
        {tab === 'discover' && (
          <>
            {/* Top 10 Film - Monumentale Netflix Style con Selettore Provider a Destra */}
            <Top10Row
              key={`discover-top10-movies-${selectedMovieProvider}`}
              type="movie"
              items={providerTop10Movies}
              selectedProvider={selectedMovieProvider}
              onSelectProvider={handleSelectMovieProvider}
              loading={providerLoading && providerTop10Movies.length === 0}
              onSelectMedia={onSelectMedia}
              onQuickPlay={handleCardQuickPlay}
            />

            {/* Top 10 Serie TV - Monumentale Netflix Style con Selettore Provider a Destra */}
            <Top10Row
              key={`discover-top10-series-${selectedSeriesProvider}`}
              type="series"
              items={providerTop10Series}
              selectedProvider={selectedSeriesProvider}
              onSelectProvider={handleSelectSeriesProvider}
              loading={providerLoading && providerTop10Series.length === 0}
              onSelectMedia={onSelectMedia}
              onQuickPlay={handleCardQuickPlay}
            />

            {/* ================= CATEGORIE ESSENZIALI CURATE E BILANCIATE (50% FILM, 50% SERIE TV, ZERO DUPLICATI) ================= */}
            {categoriesLoading && discoverCategories.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                <Loader2 className="w-7 h-7 text-cyan-400 animate-spin" />
                <p className="text-sm font-medium">Caricamento catalogo in corso...</p>
              </div>
            ) : (
              discoverCategories.map((cat) => (
                <CatalogRow
                  key={cat.id}
                  title={cat.title}
                  items={cat.items}
                  tab="discover"
                  loading={categoriesLoading && cat.items.length === 0}
                  onSelect={onSelectMedia}
                  onQuickPlay={handleCardQuickPlay}
                />
              ))
            )}
          </>
        )}

        {/* ==================== TAB 2: FILM (MOVIES) ==================== */}
        {tab === 'movies' && (
          <div className="space-y-6">
            {/* 1. Top 10 Film - Posizionato in cima, non si smonta mai */}
            <Top10Row
              key={`tab-movies-top10-${selectedMovieProvider}`}
              type="movie"
              items={providerTop10Movies}
              selectedProvider={selectedMovieProvider}
              onSelectProvider={handleSelectMovieProvider}
              loading={providerLoading && providerTop10Movies.length === 0}
              onSelectMedia={onSelectMedia}
              onQuickPlay={handleCardQuickPlay}
            />

            {/* 2. Generi / Categorie - Sempre sotto la Top 10, immobile nella stessa posizione */}
            <div className="my-6">
              <CategoryCarouselBar
                type="movie"
                genres={MOVIE_GENRE_DEFINITIONS}
                selectedGenreName={selectedMovieGenre}
                onSelectGenre={setSelectedMovieGenre}
              />
            </div>

            {/* 3. Contenuto sotto la barra generi: Dettaglio del genere o tutte le categorie */}
            {selectedMovieGenre !== 'Tutti' ? (
              (() => {
                const currentGenreDef =
                  MOVIE_GENRE_DEFINITIONS.find((g) => g.name === selectedMovieGenre) ||
                  MOVIE_GENRE_DEFINITIONS[1];
                return (
                  <CategoryDetailView
                    key={`movie-genre-${selectedMovieGenre}`}
                    type="movie"
                    genreDef={currentGenreDef}
                    items={genreGridItems}
                    loading={genreGridLoading}
                    onSelectMedia={onSelectMedia}
                    onPlayStream={onPlayStream}
                    onBackToAll={() => setSelectedMovieGenre('Tutti')}
                  />
                );
              })()
            ) : (
              categoriesLoading && movieCategories.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                  <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
                  <p className="text-sm font-medium">Caricamento catalogo film in corso...</p>
                </div>
              ) : (
                movieCategories.map((cat) => (
                  <CatalogRow
                    key={cat.id}
                    title={cat.title}
                    items={cat.items}
                    tab="movies"
                    loading={categoriesLoading && cat.items.length === 0}
                    onSelect={onSelectMedia}
                    onQuickPlay={handleCardQuickPlay}
                  />
                ))
              )
            )}
          </div>
        )}

        {/* ==================== TAB 3: SERIE TV (SERIES) ==================== */}
        {tab === 'series' && (
          <div className="space-y-6">
            {/* ================= BOTTONI SELEZIONE TRA SERIE TV E LIVE TV (SOTTO IL PRIMO CAROSELLO HERO, SOPRA LA TOP 10) ================= */}
            <div className="flex justify-center items-center -mt-3 mb-2 sm:-mt-4 sm:mb-4 z-10 relative">
              <div className="flex items-center gap-2 p-1.5 rounded-2xl border border-white/25 shadow-xl bg-black/85 backdrop-blur-2xl">
                <button
                  type="button"
                  onClick={() => setSeriesSubView('series')}
                  className={`flex items-center justify-center gap-2 px-6 py-2.5 sm:px-7 sm:py-3 rounded-xl font-bold text-xs sm:text-sm tracking-wide transition-all duration-200 cursor-pointer ${
                    seriesSubView === 'series'
                      ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 text-white shadow-lg shadow-purple-600/40 scale-[1.02]'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Tv className="w-4 h-4 text-purple-300" />
                  <span>Serie TV</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSeriesSubView('livetv')}
                  className={`flex items-center justify-center gap-2 px-6 py-2.5 sm:px-7 sm:py-3 rounded-xl font-bold text-xs sm:text-sm tracking-wide transition-all duration-200 cursor-pointer ${
                    seriesSubView === 'livetv'
                      ? 'bg-gradient-to-r from-red-600 via-rose-600 to-pink-600 text-white shadow-lg shadow-rose-600/40 scale-[1.02]'
                      : 'text-slate-300 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Radio className="w-4 h-4 text-rose-400 animate-pulse" />
                  <span>Canali TV</span>
                </button>
              </div>
            </div>

            {/* Mostra o il Catalogo Serie TV o i Canali Live TV a seconda della scelta */}
            {seriesSubView === 'livetv' ? (
              <LiveTvBrowser
                searchQuery={searchQuery}
                onPlayLiveChannel={(ch) => onPlayLiveChannel?.(ch)}
              />
            ) : (
              <>
                {/* 1. Top 10 Serie - Posizionato SOTTO il selettore Serie TV / Live TV, non si smonta mai */}
                <Top10Row
                  key={`tab-series-top10-${selectedSeriesProvider}`}
                  type="series"
                  items={providerTop10Series}
                  selectedProvider={selectedSeriesProvider}
                  onSelectProvider={handleSelectSeriesProvider}
                  loading={providerLoading && providerTop10Series.length === 0}
                  onSelectMedia={onSelectMedia}
                  onQuickPlay={handleCardQuickPlay}
                />

                {/* 2. Generi / Categorie - Sempre sotto la Top 10, immobile nella stessa posizione */}
                <div className="my-6">
                  <CategoryCarouselBar
                    type="series"
                    genres={SERIES_GENRE_DEFINITIONS}
                    selectedGenreName={selectedSeriesGenre}
                    onSelectGenre={setSelectedSeriesGenre}
                  />
                </div>

                {/* 3. Contenuto sotto la barra generi: Dettaglio del genere o tutte le categorie */}
                {selectedSeriesGenre !== 'Tutti' ? (
                  (() => {
                    const currentGenreDef =
                      SERIES_GENRE_DEFINITIONS.find((g) => g.name === selectedSeriesGenre) ||
                      SERIES_GENRE_DEFINITIONS[1];
                    return (
                      <CategoryDetailView
                        key={`series-genre-${selectedSeriesGenre}`}
                        type="series"
                        genreDef={currentGenreDef}
                        items={genreGridItems}
                        loading={genreGridLoading}
                        onSelectMedia={onSelectMedia}
                        onPlayStream={onPlayStream}
                        onBackToAll={() => setSelectedSeriesGenre('Tutti')}
                      />
                    );
                  })()
                ) : (
                  categoriesLoading && seriesCategories.length === 0 ? (
                    <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
                      <Loader2 className="w-7 h-7 text-cyan-400 animate-spin" />
                      <p className="text-sm font-medium">Caricamento catalogo serie TV in corso...</p>
                    </div>
                  ) : (
                    seriesCategories.map((cat) => (
                      <CatalogRow
                        key={cat.id}
                        title={cat.title}
                        items={cat.items}
                        tab="series"
                        loading={categoriesLoading && cat.items.length === 0}
                        onSelect={onSelectMedia}
                        onQuickPlay={handleCardQuickPlay}
                      />
                    ))
                  )
                )}
              </>
            )}
          </div>
        )}

        {/* ==================== TAB 4: LIVE TV (CANALI ITALIANI DIRETTA) ==================== */}
        {tab === 'livetv' && (
          <LiveTvBrowser
            searchQuery={searchQuery}
            onPlayLiveChannel={(ch) => onPlayLiveChannel?.(ch)}
          />
        )}
      </div>
    </div>
  );
};

// Reusable Horizontal Scrollable Catalog Row (Optimized with React.memo & viewport contain)
interface CatalogRowProps {
  title: string;
  subtitle?: string;
  items: StremioMetaPreview[];
  badge?: string;
  loading?: boolean;
  tab?: string;
  onSelect: (item: StremioMetaPreview) => void;
  onQuickPlay: (item: StremioMetaPreview) => void;
}

const CatalogRow: React.FC<CatalogRowProps> = React.memo(({
  title,
  subtitle,
  items,
  badge,
  loading,
  tab,
  onSelect,
  onQuickPlay,
}) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const iconConfig = React.useMemo(() => getCategoryIconConfig(title, tab), [title, tab]);
  const Icon = iconConfig.icon;

  // Deduplicate, filter released-only, and cap at 18 items to keep mobile memory light and responsive
  const uniqueItems = React.useMemo(() => {
    const seen = new Set<string>();
    const res: StremioMetaPreview[] = [];
    for (const it of items) {
      if (!it || !it.id) continue;
      if (seen.has(it.id)) continue;
      if (!isAlreadyReleased(it)) continue;
      seen.add(it.id);
      res.push(it);
      if (res.length >= 18) break;
    }
    return res;
  }, [items]);

  const scroll = (direction: 'left' | 'right') => {
    if (rowRef.current) {
      const distance = 460;
      rowRef.current.scrollBy({
        left: direction === 'left' ? -distance : distance,
        behavior: 'smooth',
      });
    }
  };

  if (items.length === 0 && !loading) {
    return null;
  }

  return (
    <div className="space-y-3 relative group/row catalog-row-contain">
      {/* Row Header with Thematic Icon + Title on Left and Navigation Controls on Right */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className={`p-1.5 rounded-xl border flex items-center justify-center flex-shrink-0 ${iconConfig.bgClass}`}>
            <Icon className={`w-4 h-4 ${iconConfig.colorClass}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {title}
              </h3>
              {badge && (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-red-600/20 text-rose-300 border border-red-500/30 shadow-sm">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>

        {/* Scroll Controls on the Right side */}
        <div className="flex items-center gap-1 p-1 rounded-full liquid-glass-transparent border border-white/25 shadow-md flex-shrink-0">
          <button
            type="button"
            onClick={() => scroll('left')}
            className="w-8 h-8 rounded-full text-white/90 hover:text-white hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95"
            title="Scorri a sinistra"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="w-px h-4 bg-white/20" />
          <button
            type="button"
            onClick={() => scroll('right')}
            className="w-8 h-8 rounded-full text-white/90 hover:text-white hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95"
            title="Scorri a destra"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Horizontal Carousel */}
      <div className="relative">
        <div
          ref={rowRef}
          className="flex gap-4 overflow-x-auto pb-6 pt-6 sm:pt-7 scroll-smooth scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0 -mt-2"
        >
          {uniqueItems.length === 0 && loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="w-44 sm:w-52 md:w-56 flex-shrink-0 animate-pulse">
                <div className="aspect-[2/3] rounded-2xl liquid-glass border border-white/10 bg-white/[0.03]" />
                <div className="h-3.5 bg-white/10 rounded-md mt-2.5 w-3/4" />
                <div className="h-2.5 bg-white/5 rounded-md mt-1.5 w-1/2" />
              </div>
            ))
          ) : (
            uniqueItems.map((item, index) => (
              <div key={`${item.id}-${index}`} className="relative w-44 sm:w-52 md:w-56 flex-shrink-0 pt-1 pb-1">
                <MediaCard
                  item={item}
                  onSelect={onSelect}
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

CatalogRow.displayName = 'CatalogRow';
