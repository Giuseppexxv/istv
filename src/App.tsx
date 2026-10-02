import React, { useState } from 'react';
import { ViewTab, StremioMetaPreview, StremioMetaDetail, StremioStream, StremioVideo } from './types/stremio';
import { LiquidBackground } from './components/LiquidBackground';
import { Navbar } from './components/Navbar';
import { CatalogBrowser } from './components/CatalogBrowser';
import { LibraryView } from './components/LibraryView';
import { MediaDetailModal } from './components/MediaDetailModal';
import { LiquidPlayer } from './components/LiquidPlayer';
import { LiveChannel } from './services/liveTvService';
import { LiveStreamPlayerModal } from './components/LiveStreamPlayerModal';

export default function App() {
  const [currentTab, setCurrentTab] = useState<ViewTab>('discover');
  const [searchQuery, setSearchQuery] = useState('');

  // Selected media for detail modal
  const [selectedMedia, setSelectedMedia] = useState<StremioMetaPreview | null>(null);

  // Active playing stream session (Movies / Series)
  const [activePlayback, setActivePlayback] = useState<{
    media: StremioMetaDetail;
    stream?: StremioStream | null;
    video?: StremioVideo;
  } | null>(null);

  // Active playing live TV channel session
  const [activeLiveChannel, setActiveLiveChannel] = useState<LiveChannel | null>(null);

  const handlePlayStream = React.useCallback((
    media: StremioMetaDetail,
    stream?: StremioStream,
    video?: StremioVideo
  ) => {
    setActiveLiveChannel(null);
    setActivePlayback({ media, stream: stream || null, video });
  }, []);

  const handleSelectMedia = React.useCallback((item: StremioMetaPreview) => {
    setSelectedMedia(item);
  }, []);

  const isPlayerActive = activePlayback !== null || activeLiveChannel !== null;

  return (
    <div className="relative min-h-screen bg-black text-slate-100 flex flex-col selection:bg-red-600/30 selection:text-rose-200">
      {/* Background and Navbar are unmounted during playback to put the rest of the site in zero-resource standby mode */}
      {!isPlayerActive && <LiquidBackground />}

      {!isPlayerActive && (
        <Navbar
          currentTab={currentTab}
          onSelectTab={(tab) => {
            setCurrentTab(tab);
            setSearchQuery('');
          }}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      )}

      {/* Main Viewport: kept in standby hidden state during active playback to conserve RAM and CPU */}
      <main className={`relative z-10 flex-1 ${isPlayerActive ? 'hidden' : 'block'}`}>
        <div className={currentTab === 'library' ? 'hidden' : 'block'}>
          <CatalogBrowser
            tab={currentTab === 'library' ? 'discover' : currentTab}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onSelectMedia={handleSelectMedia}
            onPlayStream={handlePlayStream}
            onPlayLiveChannel={(channel) => {
              setActiveLiveChannel(channel);
            }}
          />
        </div>

        <div className={currentTab === 'library' ? 'block' : 'hidden'}>
          <LibraryView
            onSelectMedia={handleSelectMedia}
            onPlayStream={handlePlayStream}
          />
        </div>
      </main>

      {/* Media Detail & Streams Modal */}
      {!isPlayerActive && selectedMedia && (
        <MediaDetailModal
          item={selectedMedia}
          onClose={() => setSelectedMedia(null)}
          onPlayStream={(media, stream, video) => {
            setSelectedMedia(null);
            handlePlayStream(media, stream, video);
          }}
        />
      )}

      {/* Movies / Series Player */}
      {activePlayback && (
        <LiquidPlayer
          media={activePlayback.media}
          stream={activePlayback.stream}
          video={activePlayback.video}
          onClose={() => setActivePlayback(null)}
        />
      )}

      {/* Live TV Player Modal */}
      {activeLiveChannel && (
        <LiveStreamPlayerModal
          channel={activeLiveChannel}
          onClose={() => setActiveLiveChannel(null)}
        />
      )}
    </div>
  );
}
