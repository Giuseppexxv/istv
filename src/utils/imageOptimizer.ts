/**
 * Image resolution optimizer:
 * Replaces low-resolution thumbnail URLs (e.g. Cinemeta /small/ ~180px or TMDB w185/w200/w300)
 * with crisp, high-definition assets (Metahub /medium/ ~500px, TMDB w500/w780).
 */
export function optimizeImageUrl(
  url?: string,
  type: 'poster' | 'background' | 'logo' = 'poster'
): string | undefined {
  if (!url || typeof url !== 'string') return url;

  let optimized = url.trim();

  // Cinemeta Metahub resolution upgrade:
  // Convert /poster/small/ (180px pixelated) to /poster/medium/ (500px sharp)
  if (optimized.includes('images.metahub.space/poster/small/')) {
    optimized = optimized.replace('/poster/small/', '/poster/medium/');
  }

  // Convert /background/small/ to /background/medium/
  if (optimized.includes('images.metahub.space/background/small/')) {
    optimized = optimized.replace('/background/small/', '/background/medium/');
  }

  // TMDB resolution upgrade:
  if (optimized.includes('image.tmdb.org/t/p/')) {
    if (type === 'poster') {
      optimized = optimized.replace(/\/t\/p\/(w185|w200|w300|w342)\//, '/t/p/w500/');
    } else if (type === 'background') {
      // Adaptive backdrop size: w780 loads 4x-5x faster (75KB vs 450KB) and is ultra-sharp on mobile/tablets
      const isCompact = typeof window !== 'undefined' && window.innerWidth < 1024;
      const targetSize = isCompact ? 'w780' : 'w1280';
      optimized = optimized.replace(/\/t\/p\/(w300|w500|w780|w1280|original)\//, `/t/p/${targetSize}/`);
    }
  }

  return optimized;
}
