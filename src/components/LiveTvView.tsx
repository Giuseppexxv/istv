import React, { useState, useMemo, useEffect } from 'react';
import {
  Tv,
  Search,
  Film,
  Trophy,
  Sparkles,
  Play,
  X,
  Compass,
  RefreshCw,
  Layers,
} from 'lucide-react';
import { LiveChannel, LiveNetwork, liveTvService, DEFAULT_NETWORKS, sortChannelsNumerically } from '../services/liveTvService';
import { ChannelTextBrand } from './ChannelTextBrand';

interface LiveTvViewProps {
  onPlayChannel: (channel: LiveChannel) => void;
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

export const LiveTvView: React.FC<LiveTvViewProps> = ({ onPlayChannel }) => {
  const [selectedNetwork, setSelectedNetwork] = useState<string>('all');
  const [networks, setNetworks] = useState<LiveNetwork[]>(() => liveTvService.getNetworks() || DEFAULT_NETWORKS);
  const [channels, setChannels] = useState<LiveChannel[]>(() => liveTvService.getChannels());
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    let isCancelled = false;
    setIsLoading(true);

    const loadData = async () => {
      try {
        const res = await liveTvService.fetchLiveChannels(selectedNetwork);
        if (isCancelled) return;
        setChannels(sortChannelsNumerically(res.channels || []));
        if (res.networks && res.networks.length > 0) {
          setNetworks(res.networks);
        }
      } catch (e) {
        console.warn('Failed fetch in LiveTvView:', e);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [selectedNetwork]);

  const filteredChannels = useMemo(() => {
    const list = channels.filter((ch) => {
      const matchNetwork = selectedNetwork === 'all' || ch.network === selectedNetwork;
      const matchCat = selectedCategory === 'all' || ch.category === selectedCategory;
      const query = searchQuery.trim().toLowerCase();
      const matchQuery =
        !query ||
        ch.name.toLowerCase().includes(query) ||
        (ch.rawTitle && ch.rawTitle.toLowerCase().includes(query)) ||
        (ch.networkLabel && ch.networkLabel.toLowerCase().includes(query));
      return matchNetwork && matchCat && matchQuery;
    });

    return sortChannelsNumerically(list);
  }, [channels, selectedNetwork, selectedCategory, searchQuery]);

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Network Filter Bar - Minimalist */}
      <div className="mt-6 sm:mt-7 pt-1 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <div className="flex items-center gap-1.5 px-1.5 text-xs font-medium text-slate-400 shrink-0">
          <Layers className="w-3.5 h-3.5 text-slate-400" />
          <span>Network:</span>
        </div>
        {networks.map((net) => {
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

      {/* Category Tabs + Search in a clean single line */}
      <div className="flex flex-row items-center justify-between gap-3 w-full py-1">
        {/* Left: Categories */}
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

        {/* Right: Search Input */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          <div className="relative w-40 sm:w-56 md:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cerca canale..."
              className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.08] text-xs text-slate-100 placeholder-slate-500 border border-white/[0.08] focus:outline-none focus:border-white/30 font-medium transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid Canali Live */}
      {isLoading ? (
        <div className="py-20 text-center space-y-3 rounded-2xl border border-white/[0.06] bg-[#0a0c10] p-8 flex flex-col items-center justify-center">
          <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
          <h3 className="text-sm font-semibold text-white">Caricamento canali...</h3>
        </div>
      ) : filteredChannels.length === 0 ? (
        <div className="py-16 text-center space-y-2 rounded-2xl border border-white/[0.06] bg-[#0a0c10] p-8">
          <Tv className="w-8 h-8 text-slate-500 mx-auto" />
          <h3 className="text-sm font-semibold text-white">Nessun canale trovato</h3>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filteredChannels.map((channel) => {
            const buttonStyle = getButtonHoverStyle(channel.network, channel.name);

            return (
              <div
                key={channel.id}
                onClick={() => onPlayChannel(channel)}
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
