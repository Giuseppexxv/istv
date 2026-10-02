import React from 'react';

interface ChannelTextBrandProps {
  name: string;
  network?: string;
  className?: string;
}

export const ChannelTextBrand: React.FC<ChannelTextBrandProps> = ({
  name,
  network = '',
  className = '',
}) => {
  const n = (name || '').toLowerCase().trim();
  const net = (network || '').toLowerCase().trim();

  // Determine dynamic font size based on text length
  let fontSizeClass = 'text-base sm:text-lg';
  if (name.length > 20) {
    fontSizeClass = 'text-xs sm:text-sm';
  } else if (name.length > 12) {
    fontSizeClass = 'text-sm sm:text-base';
  }

  // 1. DAZN -> Pure White Text
  if (net === 'dazn' || n.includes('dazn')) {
    return (
      <span className={`text-white font-black tracking-wide drop-shadow-sm text-center line-clamp-2 px-2 ${fontSizeClass} ${className}`}>
        {name}
      </span>
    );
  }

  // 2. RAI -> Vibrant Rai Blue
  if (net === 'rai' || n.includes('rai')) {
    return (
      <span className={`text-[#3b82f6] font-black tracking-wide drop-shadow-[0_0_12px_rgba(59,130,246,0.35)] text-center line-clamp-2 px-2 ${fontSizeClass} ${className}`}>
        {name}
      </span>
    );
  }

  // 3. MEDIASET -> Vibrant Mediaset Orange
  if (net === 'mediaset' || n.includes('canale 5') || n.includes('italia 1') || n.includes('rete 4')) {
    return (
      <span className={`text-[#f97316] font-black tracking-wide drop-shadow-[0_0_12px_rgba(249,115,22,0.35)] text-center line-clamp-2 px-2 ${fontSizeClass} ${className}`}>
        {name}
      </span>
    );
  }

  // 4. SPORTITALIA / EUROSPORT -> Celestino (Light Sky Blue)
  if (net === 'sportitalia' || n.includes('sportitalia') || n.includes('eurosport')) {
    return (
      <span className={`text-[#38bdf8] font-black tracking-wide drop-shadow-[0_0_12px_rgba(56,189,248,0.35)] text-center line-clamp-2 px-2 ${fontSizeClass} ${className}`}>
        {name}
      </span>
    );
  }

  // 5. SKY (Sky, Sky Primafila, TV8) -> Quad Gradient: Orange -> Red -> Purple -> Blue
  if (net === 'sky' || n.includes('sky') || n.includes('primafila') || n.includes('tv8') || n.includes('tv 8')) {
    return (
      <span className={`bg-gradient-to-r from-amber-400 via-rose-500 via-purple-500 to-sky-400 bg-clip-text text-transparent font-black tracking-tight drop-shadow-[0_0_12px_rgba(244,63,94,0.3)] text-center line-clamp-2 px-2 ${fontSizeClass} ${className}`}>
        {name}
      </span>
    );
  }

  // Fallback -> Silver / White Gradient
  return (
    <span className={`bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent font-extrabold tracking-wide text-center line-clamp-2 px-2 ${fontSizeClass} ${className}`}>
      {name}
    </span>
  );
};
