import React from 'react';
import { Trophy, Crown } from 'lucide-react';

/**
 * Modern, clean, and elegant logo badge for Top 10 film.
 */
export const Top10MovieLogo: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => {
  return (
    <div
      className={`relative ${className} rounded-xl flex items-center justify-center bg-gradient-to-br from-amber-500/20 via-rose-500/20 to-amber-600/10 border border-amber-400/40 shadow-sm flex-shrink-0`}
      title="Top 10 film"
    >
      <Trophy className="w-4.5 h-4.5 text-amber-400 drop-shadow-[0_2px_6px_rgba(245,158,11,0.5)]" />
    </div>
  );
};

/**
 * Modern, clean, and elegant logo badge for Top 10 serie TV.
 */
export const Top10SeriesLogo: React.FC<{ className?: string }> = ({ className = 'w-9 h-9' }) => {
  return (
    <div
      className={`relative ${className} rounded-xl flex items-center justify-center bg-gradient-to-br from-purple-500/20 via-indigo-500/20 to-cyan-500/10 border border-purple-400/40 shadow-sm flex-shrink-0`}
      title="Top 10 serie TV"
    >
      <Crown className="w-4.5 h-4.5 text-purple-300 drop-shadow-[0_2px_6px_rgba(168,85,247,0.5)]" />
    </div>
  );
};
