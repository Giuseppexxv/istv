/**
 * Extracts only the 4-digit release year from any date string or number.
 * Ensures consistent display according to user preference (year only, e.g. "2024").
 */
export const getReleaseYear = (val?: string | number | null): string => {
  if (!val) return '';
  const str = String(val).trim();
  const match = str.match(/\b(19\d{2}|20\d{2})\b/);
  if (match) return match[0];
  if (str.length >= 4 && !isNaN(Number(str.slice(0, 4)))) {
    return str.slice(0, 4);
  }
  return str;
};
