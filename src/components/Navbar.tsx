import React, { useState } from 'react';
import {
  Film,
  Tv,
  Compass,
  Bookmark,
  Search,
  X,
  Radio,
  ShieldCheck,
} from 'lucide-react';
import { ViewTab } from '../types/stremio';

interface NavbarProps {
  currentTab: ViewTab;
  onSelectTab: (tab: ViewTab) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const Navbar: React.FC<NavbarProps> = React.memo(({
  currentTab,
  onSelectTab,
  searchQuery,
  onSearchChange,
}) => {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const isScrolledRef = React.useRef(false);

  const isSearching = isSearchFocused || Boolean(searchQuery.trim());

  React.useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrolled = window.scrollY > 20;
          if (scrolled !== isScrolledRef.current) {
            isScrolledRef.current = scrolled;
            setIsScrolled(scrolled);
          }
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks: { id: ViewTab; label: string; icon: React.ReactNode }[] = [
    { id: 'discover', label: 'Scopri', icon: <Compass className="w-4 h-4" /> },
    { id: 'movies', label: 'Film', icon: <Film className="w-4 h-4" /> },
    { id: 'series', label: 'Serie TV', icon: <Tv className="w-4 h-4" /> },
    { id: 'library', label: 'Libreria', icon: <Bookmark className="w-4 h-4" /> },
  ];

  // Specific thematic color schemes for each navigation tab without white borders
  const getTabActiveStyle = (id: ViewTab) => {
    switch (id) {
      case 'discover':
        return 'text-white bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/40 font-bold scale-[1.02]';
      case 'movies':
        return 'text-white bg-gradient-to-r from-red-600 via-rose-600 to-red-600 shadow-lg shadow-red-600/40 font-bold scale-[1.02]';
      case 'series':
        return 'text-white bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 shadow-lg shadow-purple-600/40 font-bold scale-[1.02]';
      case 'library':
        return 'text-white bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 shadow-lg shadow-amber-500/40 font-bold scale-[1.02]';
      default:
        return '';
    }
  };

  const getTabHoverStyle = (id: ViewTab) => {
    switch (id) {
      case 'discover':
        return 'text-slate-300 hover:text-cyan-300 hover:bg-white/[0.06]';
      case 'movies':
        return 'text-slate-300 hover:text-rose-300 hover:bg-white/[0.06]';
      case 'series':
        return 'text-slate-300 hover:text-purple-300 hover:bg-white/[0.06]';
      case 'library':
        return 'text-slate-300 hover:text-amber-300 hover:bg-white/[0.06]';
      default:
        return '';
    }
  };

  return (
    <header className="fixed top-2 sm:top-4 left-0 right-0 z-40 px-3 sm:px-6 md:px-8 py-1 transition-all duration-300 pointer-events-none">
      <div className="relative w-full px-1 sm:px-3 md:px-6 lg:px-8 flex items-center justify-between gap-3 sm:gap-4 pointer-events-auto">
        
        {/* Brand Logo: Disappears smoothly with animation when searching */}
        <div
          id="nav-logo"
          onClick={() => onSelectTab('discover')}
          className={`relative flex items-center cursor-pointer select-none flex-shrink-0 group z-10 transition-all duration-300 ease-in-out ${
            isSearching
              ? 'opacity-0 pointer-events-none -translate-x-4 scale-95'
              : 'opacity-100 pointer-events-auto translate-x-0 scale-100'
          }`}
          title="TVWDU - Torna a Scopri"
        >
          <div className="pure-inflated-glass-wrapper relative">
            <span className="pure-inflated-glass-logo relative text-lg sm:text-xl md:text-2xl font-black tracking-wide whitespace-nowrap">
              TVWDU
            </span>
          </div>
        </div>

        {/* Central Liquid Bubble Glass Navigation Menu: Shown on Desktop, hidden on mobile horizontal */}
        <nav
          className={`nav-desktop-only absolute left-1/2 -translate-x-1/2 items-center gap-1 sm:gap-1.5 px-2.5 py-1.5 rounded-full liquid-glass-transparent border border-white/20 shadow-2xl shadow-black/80 z-20 transition-all duration-300 ease-in-out ${
            isSearching
              ? 'opacity-0 pointer-events-none scale-95 -translate-y-3'
              : 'opacity-100 pointer-events-auto scale-100 translate-y-0'
          }`}
        >
          {navLinks.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                id={`tab-${tab.id}`}
                onClick={() => onSelectTab(tab.id)}
                className={`relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold transition-all duration-300 cursor-pointer ${
                  isActive ? getTabActiveStyle(tab.id) : getTabHoverStyle(tab.id)
                }`}
              >
                <span className={`[&_svg]:w-3.5 [&_svg]:h-3.5 sm:[&_svg]:w-4 sm:[&_svg]:h-4 ${isActive ? 'text-white' : ''}`}>
                  {tab.icon}
                </span>
                <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Floating Detached Search Bar on the Right: Ultra-compact when unfocused, expands smoothly towards left */}
        <div className="relative flex items-center flex-shrink-0 ml-auto z-30">
          <div
            className={`relative flex items-center transition-all duration-300 ease-in-out liquid-glass-transparent rounded-full px-2.5 sm:px-3 py-1 sm:py-1.5 border border-white/20 shadow-2xl shadow-black/80 ${
              isSearching
                ? 'w-56 sm:w-72 md:w-96 ring-2 ring-cyan-500/50 shadow-cyan-600/20'
                : 'w-20 sm:w-24 md:w-26'
            }`}
          >
            <Search className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-cyan-400 mr-1.5 flex-shrink-0" />
            <input
              id="search-input"
              type="text"
              placeholder="Cerca..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => {
                setTimeout(() => {
                  setIsSearchFocused(false);
                }, 180);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  onSearchChange('');
                  setIsSearchFocused(false);
                  const el = document.getElementById('search-input') as HTMLInputElement | null;
                  el?.blur();
                }
              }}
              className="w-full bg-transparent text-[10px] sm:text-[11px] text-white placeholder-slate-400/80 focus:outline-none font-medium"
            />
            {isSearching && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                }}
                onClick={() => {
                  onSearchChange('');
                  setIsSearchFocused(false);
                  const el = document.getElementById('search-input') as HTMLInputElement | null;
                  el?.blur();
                }}
                className="text-slate-400 hover:text-white ml-1 p-1 rounded-full hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0"
                title="Chiudi ricerca"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Row 2: Navigation Bar below Logo and Search for mobile (both portrait and mobile landscape) */}
      <div
        className={`nav-mobile-only overflow-x-auto py-1 px-1 gap-1 scrollbar-none mt-1 justify-center pointer-events-auto transition-all duration-300 ease-in-out ${
          isSearching
            ? 'opacity-0 pointer-events-none -translate-y-3 max-h-0 overflow-hidden py-0 my-0 border-transparent'
            : 'opacity-100 pointer-events-auto translate-y-0 max-h-16'
        }`}
      >
        <div className="flex items-center gap-1 px-1.5 py-1 rounded-full liquid-glass-transparent border border-white/20">
          {navLinks.map((tab) => {
            const isActive = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive ? getTabActiveStyle(tab.id) : getTabHoverStyle(tab.id)
                }`}
              >
                <span className={isActive ? 'text-white' : ''}>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
});
