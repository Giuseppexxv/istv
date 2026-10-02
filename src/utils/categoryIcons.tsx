import React from 'react';
import {
  Sparkles,
  Flame,
  Film,
  Clapperboard,
  Smile,
  Ghost,
  Rocket,
  Compass,
  Heart,
  Search,
  ShieldAlert,
  FileText,
  Zap,
  Swords,
  Palette,
} from 'lucide-react';

/**
 * Custom Oscar Statuette icon matching Lucide style and stroke standards.
 */
export const OscarStatuette: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {/* Head */}
    <circle cx="12" cy="4" r="2" fill="currentColor" fillOpacity="0.25" />
    {/* Shoulders & Chest */}
    <path d="M8.5 8.5h7l-1 5.5h-5l-1-5.5Z" fill="currentColor" fillOpacity="0.15" />
    {/* Vertical Sword held down the center */}
    <path d="M12 7.5v9.5" />
    <path d="M10.5 9.5h3" />
    {/* Lower Body */}
    <path d="M10 14v4.5h4V14" />
    {/* Pedestal Base */}
    <path d="M8.5 19.5h7" />
    <path d="M7 21.5h10" />
  </svg>
);

interface CategoryIconConfig {
  icon: React.ElementType;
  colorClass: string;
  bgClass: string;
}

export type AppTabContext = 'discover' | 'movies' | 'series' | 'movie' | 'all' | string;

/**
 * Returns the contextual icon and tab-coordinated colors:
 * - Discover (Scopri): Cyan / Sky Blue palette (matches Scopri tab color)
 * - Movies (Film): Rose / Red palette
 * - Series (Serie TV): Purple / Violet palette
 */
export function getCategoryIconConfig(title: string, tabContext?: AppTabContext): CategoryIconConfig {
  const t = title.toLowerCase();

  // 1. Determine Icon based on meaning of the phrase
  let IconComponent: React.ElementType = Film;

  if (/miglior|votat|top|capolavor|premiat|oscar/i.test(t)) {
    IconComponent = OscarStatuette;
  } else if (/recent|novit|nuov|ultim/i.test(t)) {
    IconComponent = Sparkles;
  } else if (/superero|marvel|dc|comic|fumett|poteri/i.test(t)) {
    IconComponent = Zap;
  } else if (/dramm|auteur|autore|cinefil/i.test(t)) {
    IconComponent = Clapperboard;
  } else if (/commed|ridere|sitcom|satir|divertent/i.test(t)) {
    IconComponent = Smile;
  } else if (/azion|blockbuster|adrenalin|combatt/i.test(t)) {
    IconComponent = Flame;
  } else if (/horror|brivid|demoni|oscur/i.test(t)) {
    IconComponent = Ghost;
  } else if (/fantascienza|sci-fi|spazio|cosm|distop|alien/i.test(t)) {
    IconComponent = Rocket;
  } else if (/crime|poliz|indagin|detective|gang|mafia|delitt/i.test(t)) {
    IconComponent = Search;
  } else if (/thriller|suspense|tensione|colpi di scena/i.test(t)) {
    IconComponent = ShieldAlert;
  } else if (/animaz|anime|manga|carton/i.test(t)) {
    IconComponent = Palette;
  } else if (/avventur|viagg|esploraz/i.test(t)) {
    IconComponent = Compass;
  } else if (/romant|amor|passion|sentiment/i.test(t)) {
    IconComponent = Heart;
  } else if (/documentar|storia|scienza|natura|terra|sport/i.test(t)) {
    IconComponent = FileText;
  } else if (/fantasy|magia|regn|epico/i.test(t)) {
    IconComponent = Swords;
  }

  // 2. Determine Color Palette matching the active Tab
  const ctx = (tabContext || 'discover').toLowerCase();

  if (ctx === 'movies' || ctx === 'movie') {
    return {
      icon: IconComponent,
      colorClass: 'text-rose-400',
      bgClass: 'bg-rose-500/15 border-rose-500/30',
    };
  }

  if (ctx === 'series') {
    return {
      icon: IconComponent,
      colorClass: 'text-purple-400',
      bgClass: 'bg-purple-500/15 border-purple-500/30',
    };
  }

  // Exact Cyan / Sky Blue palette for Scopri (Discover tab)
  return {
    icon: IconComponent,
    colorClass: 'text-cyan-400',
    bgClass: 'bg-cyan-500/15 border-cyan-500/30',
  };
}
