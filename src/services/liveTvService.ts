export interface LiveNetwork {
  id: string;
  name: string;
}

export type ChannelCategory = 'sport' | 'cinema' | 'general';

export interface LiveChannel {
  id: string;
  name: string;
  rawTitle: string;
  server?: string;
  network?: string;
  networkLabel?: string;
  logo?: string;
  group?: string;
  category: ChannelCategory;
  categoryLabel: string;
  streamUrl: string;
  playerUrl: string;
  watchUrl: string;
}

export interface LiveChannelsResponse {
  success: boolean;
  provider: string;
  source: string;
  networks: LiveNetwork[];
  channels: LiveChannel[];
  isFallback?: boolean;
}

export const DEFAULT_NETWORKS: LiveNetwork[] = [
  { id: 'all', name: 'Tutti' },
  { id: 'sky', name: 'Sky' },
  { id: 'dazn', name: 'DAZN' },
  { id: 'rai', name: 'Rai' },
  { id: 'mediaset', name: 'Mediaset' },
  { id: 'sportitalia', name: 'Sportitalia' },
];

const NETWORK_ORDER: Record<string, number> = {
  sky: 1,
  dazn: 2,
  rai: 3,
  mediaset: 4,
  sportitalia: 5,
};

export function sortChannelsNumerically(channels: LiveChannel[]): LiveChannel[] {
  const collator = new Intl.Collator('it', { numeric: true, sensitivity: 'base' });
  return [...channels].sort((a, b) => {
    const orderA = NETWORK_ORDER[(a.network || '').toLowerCase()] || 99;
    const orderB = NETWORK_ORDER[(b.network || '').toLowerCase()] || 99;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return collator.compare(a.name, b.name);
  });
}

let cachedChannels: LiveChannel[] = [];
let cachedNetworks: LiveNetwork[] = DEFAULT_NETWORKS;

export const liveTvService = {
  getChannels(): LiveChannel[] {
    return sortChannelsNumerically(cachedChannels);
  },

  getNetworks(): LiveNetwork[] {
    return cachedNetworks;
  },

  async fetchLiveChannels(network = 'all'): Promise<LiveChannelsResponse> {
    try {
      const url = network && network !== 'all'
        ? `/api/live-channels?network=${encodeURIComponent(network)}`
        : '/api/live-channels';

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }
      const data: LiveChannelsResponse = await response.json();
      if (data && data.success && Array.isArray(data.channels)) {
        const sorted = sortChannelsNumerically(data.channels);
        if (network === 'all') {
          cachedChannels = sorted;
        }
        if (Array.isArray(data.networks) && data.networks.length > 0) {
          cachedNetworks = data.networks;
        }
        return {
          ...data,
          networks: cachedNetworks,
          channels: sorted,
        };
      }
    } catch (err) {
      console.warn('[LiveTvService] Error fetching live channels:', err);
    }

    return {
      success: true,
      provider: 'vavoo.to',
      source: 'https://vavoo.to/#/channels',
      networks: cachedNetworks,
      channels: sortChannelsNumerically(cachedChannels),
      isFallback: true,
    };
  },
};
