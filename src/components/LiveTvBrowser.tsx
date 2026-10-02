import React, { useState, useEffect, useMemo } from 'react';
import {
  Tv,
  Search,
  Play,
  Trophy,
  Film,
  Sparkles,
  Compass,
  Layers,
  X,
} from 'lucide-react';
import { liveTvService, LiveChannel, DEFAULT_NETWORKS, sortChannelsNumerically } from '../services/liveTvService';
import { ChannelTextBrand } from './ChannelTextBrand';

interface LiveTvBrowserProps {
  searchQuery?: string;
  onPlayLiveChannel: (channel: LiveChannel) => void;
}

interface CategoryConfig {
  name: string;
  id: string;
  icon: React.ReactNode;
  activeClass: string;
  idleClass: string;
}

const CATEGORY_CONFIGS: CategoryConfig[] = [
  {
    name: 'Tutti',
    id: 'all',
    icon: <Sparkles className="w-3.5 h-3.5" />,
    activeClass: 'bg-white text-black font-bold shadow-[0_0_16px_rgba(255,255,255,0.3)]',
    idleClass: 'bg-white/[0.04] text-slate-300 hover:text-white hover:bg-white/[0.08] border border-white/[0.08]',
  },
  {
    name: 'Sport',
    id: 'sport',
    icon: <Trophy className="w-3.5 h-3.5" />,
    activeClass: 'bg-emerald-500 text-black font-bold shadow-[0_0_18px_rgba(16,185,129,0.4)]',
    idleClass: 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 border border-emerald-500/25',
  },
  {
    name: 'Cinema',
    id: 'cinema',
    icon: <Film className="w-3.5 h-3.5" />,
    activeClass: 'bg-amber-500 text-black font-bold shadow-[0_0_18px_rgba(245,158,11,0.4)]',
    idleClass: 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 border border-amber-500/25',
  },
  {
    name: 'Intrattenimento',
    id: 'general',
    icon: <Compass className="w-3.5 h-3.5" />,
    activeClass: 'bg-sky-500 text-black font-bold shadow-[0_0_18px_rgba(56,189,248,0.4)]',
    idleClass: 'bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 hover:text-sky-300 border border-sky-500/25',
  },
];

function renderCategoryBadge(category: string, label: string) {
  const cat = (category || '').toLowerCase();
  const text = label || (cat === 'sport' ? 'Sport' : cat === 'cinema' ? 'Cinema' : 'Intrattenimento');

  if (cat === 'sport') {
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0">
        {text}
      </span>
    );
  }
  if (cat === 'cinema') {
    return (
      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
        {text}
      </span>
    );
  }
  // Intrattenimento / General
  return (
    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-500/15 border border-sky-500/30 text-sky-400 shrink-0">
      {text}
    </span>
  );
}

function getButtonHoverStyle(network: string = '', name: string = '') {
  const net = network.toLowerCase();
  const n = name.toLowerCase();

  if (net === 'dazn' || n.includes('dazn')) {
    return 'bg-white/10 group-hover:bg-[#facc15] text-white group-hover:text-black font-bold';
  }
  if (net === 'rai' || n.includes('rai')) {
    return 'bg-white/10 group-hover:bg-[#3b82f6] text-white font-semibold';
  }
  if (net === 'mediaset' || n.includes('canale 5') || n.includes('italia 1') || n.includes('rete 4')) {
    return 'bg-white/10 group-hover:bg-[#ea580c] text-white font-semibold';
  }
  if (net === 'sportitalia' || n.includes('sportitalia')) {
    return 'bg-white/10 group-hover:bg-[#38bdf8] text-white group-hover:text-black font-bold';
  }
  // Sky
  return 'bg-white/10 group-hover:bg-gradient-to-r group-hover:from-amber-400 group-hover:via-rose-500 group-hover:to-sky-400 text-white group-hover:text-black font-bold';
}

export const LiveTvBrowser: React.FC<LiveTvBrowserProps> = ({
  searchQuery: parentSearchQuery = '',
  onPlayLiveChannel,
}) => {
  const [channels, setChannels] = useState<LiveChannel[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedNetwork, setSelectedNetwork] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [localSearch, setLocalSearch] = useState<string>('');

  useEffect(() => {
    let active = true;
    const fetchChannels = async () => {
      setLoading(true);
      try {
        const data = await liveTvService.fetchLiveChannels();
        if (active) {
          setChannels(sortChannelsNumerically(data.channels || []));
        }
      } catch (err) {
        console.error('Failed loading live channels:', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    fetchChannels();
    return () => {
      active = false;
    };
  }, []);

  const effectiveSearch = (parentSearchQuery || localSearch).trim().toLowerCase();

  const filteredChannels = useMemo(() => {
    const list = channels.filter((channel) => {
      if (selectedNetwork !== 'all' && channel.network !== selectedNetwork) {
        return false;
      }
      if (selectedCategory !== 'all' && channel.category !== selectedCategory) {
        return false;
      }
      if (effectiveSearch) {
        const name = channel.name.toLowerCase();
        const rawTitle = (channel.rawTitle || '').toLowerCase();
        const network = (channel.networkLabel || '').toLowerCase();
        return (
          name.includes(effectiveSearch) ||
          rawTitle.includes(effectiveSearch) ||
          network.includes(effectiveSearch)
        );
      }
      return true;
    });

    return sortChannelsNumerically(list);
  }, [channels, selectedNetwork, selectedCategory, effectiveSearch]);

  return (
    <div className="space-y-5 pb-16">
      {/* Network Filter Bar - Minimalist and spaced lower */}
      <div className="mt-6 sm:mt-7 pt-1 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
        <div className="flex items-center gap-1.5 px-1.5 text-xs font-medium text-slate-400 shrink-0">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span>Network:</span>
        </div>
        {DEFAULT_NETWORKS.map((net) => {
          const isSelected = selectedNetwork === net.id;
          return (
            <button
              key={net.id}
              type="button"
              onClick={() => {
                setSelectedNetwork(net.id);
                setSelectedCategory('all');
              }}
              className={`px-3 py-1 rounded-xl text-xs font-medium transition-colors cursor-pointer shrink-0 ${
                isSelected
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'bg-white/[0.05] hover:bg-white/[0.12] text-slate-300'
              }`}
            >
              <span>{net.name}</span>
            </button>
          );
        })}
      </div>

      {/* Subcategorizzazioni: Tutti, Sport, Cinema, Intrattenimento with pertinent colors */}
      <div className="flex flex-row items-center justify-between gap-3 w-full py-1">
        {/* Category Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto py-0.5 scrollbar-none shrink min-w-0">
          {CATEGORY_CONFIGS.map((cat) => {
            const isSelected = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  isSelected ? cat.activeClass : cat.idleClass
                }`}
              >
                {cat.icon}
                <span>{cat.name}</span>
              </button>
            );
          })}
        </div>

        {/* Search Input on Right */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <div className="relative w-40 sm:w-56 md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Cerca canale..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-xs text-slate-100 placeholder-slate-500 border border-white/[0.08] focus:outline-none focus:border-white/30 font-medium transition-colors"
            />
            {localSearch && (
              <button
                type="button"
                onClick={() => setLocalSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="text-[11px] text-slate-500 font-mono whitespace-nowrap hidden md:block">
            {filteredChannels.length} canali
          </div>
        </div>
      </div>

      {/* Grid Canali Live - Pure Black Cards, Styled Channel Text, Category Badge Left, Live Pulse Right */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div
              key={idx}
              className="animate-pulse rounded-2xl border border-white/[0.05] bg-[#0a0c10] p-4 flex flex-col justify-between gap-3 h-44"
            >
              <div className="flex justify-between items-center w-full">
                <div className="h-3 w-12 bg-white/10 rounded" />
                <div className="h-3 w-12 bg-white/10 rounded" />
              </div>
              <div className="w-full h-12 bg-white/5 rounded-xl" />
              <div className="h-8 bg-white/5 rounded-xl w-full" />
            </div>
          ))}
        </div>
      ) : filteredChannels.length === 0 ? (
        <div className="py-16 rounded-2xl border border-white/[0.06] bg-[#0a0c10] text-center text-slate-400 space-y-2">
          <Tv className="w-8 h-8 mx-auto text-slate-600" />
          <p className="text-sm font-medium">Nessun canale trovato.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filteredChannels.map((channel) => {
            const buttonStyle = getButtonHoverStyle(channel.network, channel.name);

            return (
              <div
                key={channel.id}
                onClick={() => onPlayLiveChannel(channel)}
                className="group relative rounded-2xl p-3 sm:p-3.5 bg-[#0a0c10] border border-white/[0.08] hover:border-white/25 hover:shadow-[0_0_24px_rgba(0,0,0,0.8)] transition-all duration-200 hover:-translate-y-1 cursor-pointer flex flex-col justify-between gap-3"
              >
                {/* Top Row: Category Badge on Left, LIVE Indicator on Right (No network badge) */}
                <div className="flex items-center justify-between gap-2 z-10 text-[10px]">
                  {/* Category Badge on Left */}
                  {renderCategoryBadge(channel.category, channel.categoryLabel)}

                  {/* LIVE Indicator on Right */}
                  <span className="flex items-center gap-1 text-[9px] font-bold text-red-400 shrink-0 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    <span>LIVE</span>
                  </span>
                </div>

                {/* Center Stage: Channel Name Text in Network Specific Colors/Gradients */}
                <div className="my-auto py-1 flex items-center justify-center z-10 w-full min-h-[64px]">
                  <div className="h-16 w-full flex items-center justify-center p-2 rounded-xl bg-white/[0.03] border border-white/[0.06] group-hover:border-white/20 transition-colors overflow-hidden">
                    <ChannelTextBrand name={channel.name} network={channel.network} />
                  </div>
                </div>

                {/* Bottom: Action Button */}
                <div className="w-full z-10">
                  <button
                    type="button"
                    className={`w-full py-1.5 ${buttonStyle} text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Guarda</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
