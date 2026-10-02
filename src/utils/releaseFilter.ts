import { StremioMetaPreview } from '../types/stremio';

/**
 * Checks whether a title is an obscure, junk, test, or malformed entry
 * such as date-formatted titles ("27 agosto 2015"), "KG 2055", clips, or empty entries.
 */
export function isJunkOrObscure(item: StremioMetaPreview | null | undefined): boolean {
  if (!item || !item.name) return true;
  const name = item.name.trim();
  if (name.length < 2) return true;

  // 1. Titles starting with dates: e.g. "27 agosto 2015", "12 March 2020", "2015-08-27"
  const datePattern =
    /^\d{1,2}\s+(gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|january|february|march|april|may|june|july|august|september|october|november|december)\b/i;
  if (datePattern.test(name)) return true;

  // 2. Technical markers, scrapers, episode snippets or junk codes (like "KG 2055", "Episode 1", etc.)
  const junkCodePattern =
    /\b(kg\s*\d+|episode\s*\d+|season\s*\d+|puntata\s*\d+|stagione\s*\d+|clip\b|test\s*entry|untitled\s*project)\b/i;
  if (junkCodePattern.test(name)) return true;

  // 3. Entries without poster AND without any rating (obscure ghost records)
  const hasPoster = !!item.poster && !item.poster.includes('unsplash');
  const hasRating =
    item.imdbRating && item.imdbRating !== 'N/A' && item.imdbRating !== '0' && item.imdbRating !== '';
  if (!hasPoster && !hasRating) return true;

  return false;
}

/**
 * Known upcoming unreleased titles (announced/in-production/future premiere)
 * that must NEVER appear in catalog or carousels until they are officially released.
 */
const KNOWN_UNRELEASED_PATTERNS: RegExp[] = [
  /avengers\s*:\s*doomsday/i,
  /avengers\s*doomsday/i,
  /avengers\s*:\s*secret\s*wars/i,
  /avengers\s*secret\s*wars/i,
  /spider-man\s*:\s*beyond\s*the\s*spider-verse/i,
  /the\s*batman\s*(-|:)?\s*part\s*ii\b/i,
  /shrek\s*5\b/i,
  /toy\s*story\s*5\b/i,
  /frozen\s*(3\b|iii\b)/i,
  /fast\s*x\s*(:|–|-)?\s*part\s*2\b/i,
  /star\s*wars\s*:\s*(new\s*jedi\s*order|the\s*mandalorian\s*&\s*grogu)/i,
  /supergirl\s*:\s*woman\s*of\s*tomorrow/i,
  /dune\s*:\s*messiah/i,
  /blade\s*\(202[5-9]\)/i,
];

/**
 * Determines whether a title (movie or series) has already been officially released
 * on or before the reference date (defaults to today).
 * Strictly excludes any future releases, upcoming cinema premieres, or unreleased titles.
 */
export function isAlreadyReleased(
  item: StremioMetaPreview | null | undefined,
  referenceDate: Date = new Date()
): boolean {
  if (!item) return false;
  if (isJunkOrObscure(item)) return false;

  const name = item.name?.trim() || '';

  // 1. Explicit check against known unreleased upcoming blockbusters (e.g. Avengers: Doomsday)
  if (KNOWN_UNRELEASED_PATTERNS.some((p) => p.test(name))) {
    return false;
  }

  // 2. Check status flags (e.g. In Production, Post-production, Planned, Announced, Upcoming)
  const rawStatus = String((item as any).status || (item as any).release_status || '').toLowerCase();
  if (
    rawStatus.includes('upcoming') ||
    rawStatus.includes('announced') ||
    rawStatus.includes('in production') ||
    rawStatus.includes('post-production') ||
    rawStatus.includes('planned')
  ) {
    return false;
  }

  // End of the reference date (inclusive of entire today, until 23:59:59.999)
  const endOfToday = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
    23,
    59,
    59,
    999
  ).getTime();
  const currentYear = referenceDate.getFullYear();

  // 3. Check exact ISO / full date in `released`, `releaseDate` or `first_air_date`
  const rawReleased = (item as any).released || (item as any).releaseDate || (item as any).first_air_date;
  if (rawReleased && typeof rawReleased === 'string' && rawReleased.trim()) {
    // If it contains a full date (YYYY-MM-DD or ISO timestamp)
    const fullDateMatch = rawReleased.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (fullDateMatch) {
      const y = parseInt(fullDateMatch[1], 10);
      const m = parseInt(fullDateMatch[2], 10) - 1;
      const d = parseInt(fullDateMatch[3], 10);
      const parsed = new Date(y, m, d, 23, 59, 59, 999);
      if (!isNaN(parsed.getTime())) {
        if (parsed.getTime() > endOfToday) {
          return false;
        }
      }
    } else {
      const parsedDate = new Date(rawReleased);
      if (!isNaN(parsedDate.getTime()) && rawReleased.length > 7) {
        if (parsedDate.getTime() > endOfToday) {
          return false;
        }
      }
    }
  }

  // 4. Check `releaseInfo` or `year`
  const relInfo = item.releaseInfo || (item as any).year;
  if (relInfo) {
    const relStr = String(relInfo).trim();

    // Check for full date format: YYYY-MM-DD
    const fullDateMatch = relStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (fullDateMatch) {
      const year = parseInt(fullDateMatch[1], 10);
      const month = parseInt(fullDateMatch[2], 10) - 1;
      const day = parseInt(fullDateMatch[3], 10);
      const parsed = new Date(year, month, day, 23, 59, 59, 999);
      if (!isNaN(parsed.getTime())) {
        if (parsed.getTime() > endOfToday) {
          return false;
        }
      }
    }

    // Check 4-digit year (e.g. "2027", "2026", "2024")
    const yearMatch = relStr.match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1], 10);
      // Strictly exclude any future years
      if (year > currentYear) {
        return false;
      }

      // If the movie has the CURRENT year (or >= 2026), it MUST be actually released:
      // On IMDb and streaming catalogs, unreleased films have NO user rating yet (votes open only upon theatrical premiere).
      // Any movie in current year with no rating or rating 0 / N/A has not been released yet!
      if (item.type === 'movie' && year >= currentYear) {
        const ratingNum = parseFloat(String(item.imdbRating || '0'));
        if (isNaN(ratingNum) || ratingNum <= 0) {
          // No rating in current year = unreleased future movie
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Ranks items by fame, popularity, and rating.
 * If a search query is provided, prioritizing exact/prefix matches and acclaimed titles.
 */
export function rankFamousItems(
  items: StremioMetaPreview[],
  query?: string
): StremioMetaPreview[] {
  if (!Array.isArray(items)) return [];
  const q = query ? query.toLowerCase().trim() : '';

  return [...items].sort((a, b) => {
    // 1. Match relevance if searching
    if (q) {
      const aName = (a.name || '').toLowerCase();
      const bName = (b.name || '').toLowerCase();
      const aExact = aName === q;
      const bExact = bName === q;
      if (aExact && !bExact) return -1;
      if (bExact && !aExact) return 1;

      const aStarts = aName.startsWith(q);
      const bStarts = bName.startsWith(q);
      if (aStarts && !bStarts) return -1;
      if (bStarts && !aStarts) return 1;
    }

    // 2. High rating score (famous recognized cinema / TV)
    const aRating = parseFloat(String(a.imdbRating || '0')) || 0;
    const bRating = parseFloat(String(b.imdbRating || '0')) || 0;

    // Favor items with verified IMDb rating
    const aHasRating = aRating > 0 ? 1 : 0;
    const bHasRating = bRating > 0 ? 1 : 0;
    if (aHasRating !== bHasRating) {
      return bHasRating - aHasRating;
    }

    // Sort by rating
    if (Math.abs(bRating - aRating) > 0.3) {
      return bRating - aRating;
    }

    return 0;
  });
}

/**
 * Filters any list of Stremio items ensuring only already released titles
 * (or released today) and non-junk titles are kept, sorted by fame/quality.
 */
export function filterReleasedItems(
  items: StremioMetaPreview[],
  maxCount?: number,
  referenceDate: Date = new Date()
): StremioMetaPreview[] {
  if (!Array.isArray(items)) return [];
  const valid = items.filter((it) => isAlreadyReleased(it, referenceDate));
  const ranked = rankFamousItems(valid);
  return typeof maxCount === 'number' && maxCount > 0 ? ranked.slice(0, maxCount) : ranked;
}

/**
 * Specifically for Top 10 rows: preserves exact order of ranks (1 to 10)
 * while filtering out unreleased or duplicate entries.
 */
export function filterReleasedTopItems(
  items: StremioMetaPreview[],
  maxCount: number = 10,
  referenceDate: Date = new Date()
): StremioMetaPreview[] {
  if (!Array.isArray(items)) return [];
  const seen = new Set<string>();
  const res: StremioMetaPreview[] = [];
  for (const it of items) {
    if (!it || !it.id || seen.has(it.id)) continue;
    if (!isAlreadyReleased(it, referenceDate)) continue;
    seen.add(it.id);
    res.push(it);
    if (res.length >= maxCount) break;
  }
  return res;
}


