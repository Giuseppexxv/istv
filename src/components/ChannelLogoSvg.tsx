import React from 'react';
import { ChannelBrandLogo } from './ChannelBrandLogo';

interface ChannelLogoSvgProps {
  channelName: string;
  className?: string;
}

export const ChannelLogoSvg: React.FC<ChannelLogoSvgProps> = ({ channelName, className = 'w-full h-full' }) => {
  return <ChannelBrandLogo name={channelName} className={className} />;
};
