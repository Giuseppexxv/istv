export interface ProviderConfig {
  id: string;
  name: string;
  shortName: string;
  logoUrl?: string;
  isGlobal?: boolean;
  movieCatalogId: string;
  seriesCatalogId: string;
  movieSubtitle: string;
  seriesSubtitle: string;
  accentColor: string;
  badgeGlow: string;
  activeClass: string;
}

export const STREAMING_PROVIDERS: ProviderConfig[] = [
  {
    id: 'global',
    name: 'Globale',
    shortName: 'Globale',
    isGlobal: true,
    movieCatalogId: 'popular-movie-global',
    seriesCatalogId: 'popular-series-global',
    movieSubtitle: 'I 10 film più popolari e visti al mondo oggi',
    seriesSubtitle: 'Le 10 serie TV più popolari e viste al mondo oggi',
    accentColor: '#f59e0b',
    badgeGlow: 'rgba(245, 158, 11, 0.4)',
    activeClass: 'border-amber-400/90 bg-amber-500/25 text-amber-300 shadow-[0_0_22px_rgba(245,158,11,0.4)]',
  },
  {
    id: 'netflix',
    name: 'Netflix',
    shortName: 'Netflix',
    logoUrl: '/providers/netflix.svg',
    movieCatalogId: 'netflix-movies-italy',
    seriesCatalogId: 'netflix-series-italy',
    movieSubtitle: 'I 10 film più visti su Netflix in Italia oggi',
    seriesSubtitle: 'Le 10 serie TV più viste su Netflix in Italia oggi',
    accentColor: '#e50914',
    badgeGlow: 'rgba(229, 9, 20, 0.45)',
    activeClass: 'border-red-500/90 bg-red-600/25 text-white shadow-[0_0_22px_rgba(229,9,20,0.45)]',
  },
  {
    id: 'prime',
    name: 'Prime Video',
    shortName: 'Prime Video',
    logoUrl: '/providers/prime.svg',
    movieCatalogId: 'amazon-prime-movies-italy',
    seriesCatalogId: 'amazon-prime-series-italy',
    movieSubtitle: 'I 10 film più visti su Prime Video in Italia oggi',
    seriesSubtitle: 'Le 10 serie TV più viste su Prime Video in Italia oggi',
    accentColor: '#00a8e1',
    badgeGlow: 'rgba(0, 168, 225, 0.4)',
    activeClass: 'border-sky-400/90 bg-sky-500/25 text-white shadow-[0_0_22px_rgba(0,168,225,0.4)]',
  },
  {
    id: 'disney',
    name: 'Disney+',
    shortName: 'Disney+',
    logoUrl: '/providers/disney.svg',
    movieCatalogId: 'disney-movies-italy',
    seriesCatalogId: 'disney-series-italy',
    movieSubtitle: 'I 10 film più visti su Disney+ in Italia oggi',
    seriesSubtitle: 'Le 10 serie TV più viste su Disney+ in Italia oggi',
    accentColor: '#38bdf8',
    badgeGlow: 'rgba(56, 189, 248, 0.4)',
    activeClass: 'border-cyan-400/90 bg-cyan-600/25 text-white shadow-[0_0_22px_rgba(56,189,248,0.4)]',
  },
  {
    id: 'apple',
    name: 'Apple TV+',
    shortName: 'Apple TV+',
    logoUrl: '/providers/apple.svg',
    movieCatalogId: 'apple-tv-movies-italy',
    seriesCatalogId: 'apple-tv-series-italy',
    movieSubtitle: 'I 10 film più visti su Apple TV+ in Italia oggi',
    seriesSubtitle: 'Le 10 serie TV più viste su Apple TV+ in Italia oggi',
    accentColor: '#ffffff',
    badgeGlow: 'rgba(255, 255, 255, 0.35)',
    activeClass: 'border-white/90 bg-white/25 text-white shadow-[0_0_22px_rgba(255,255,255,0.35)]',
  },
  {
    id: 'now',
    name: 'NOW (Sky)',
    shortName: 'NOW',
    logoUrl: '/providers/now.svg',
    movieCatalogId: 'now-movies-italy',
    seriesCatalogId: 'now-series-italy',
    movieSubtitle: 'I 10 film più visti su NOW in Italia oggi',
    seriesSubtitle: 'Le 10 serie TV più viste su NOW in Italia oggi',
    accentColor: '#10b981',
    badgeGlow: 'rgba(16, 185, 129, 0.4)',
    activeClass: 'border-emerald-400/90 bg-emerald-500/25 text-white shadow-[0_0_22px_rgba(16,185,129,0.4)]',
  },
  {
    id: 'paramount',
    name: 'Paramount+',
    shortName: 'Paramount+',
    logoUrl: '/providers/paramount.svg',
    movieCatalogId: 'paramount-plus-movies-italy',
    seriesCatalogId: 'paramount-plus-series-italy',
    movieSubtitle: 'I 10 film più visti su Paramount+ in Italia oggi',
    seriesSubtitle: 'Le 10 serie TV più viste su Paramount+ in Italia oggi',
    accentColor: '#60a5fa',
    badgeGlow: 'rgba(96, 165, 250, 0.4)',
    activeClass: 'border-blue-400/90 bg-blue-600/25 text-white shadow-[0_0_22px_rgba(96,165,250,0.4)]',
  },
  {
    id: 'max',
    name: 'Max (HBO)',
    shortName: 'Max',
    logoUrl: '/providers/max.svg',
    movieCatalogId: 'hbo-max-movies-italy',
    seriesCatalogId: 'hbo-max-series-italy',
    movieSubtitle: 'I 10 film più visti su HBO Max oggi',
    seriesSubtitle: 'Le 10 serie TV più viste su HBO Max oggi',
    accentColor: '#a855f7',
    badgeGlow: 'rgba(168, 85, 247, 0.4)',
    activeClass: 'border-purple-400/90 bg-purple-600/25 text-white shadow-[0_0_22px_rgba(168,85,247,0.4)]',
  },
];
