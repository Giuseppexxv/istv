import React from 'react';

export const LiquidBackground: React.FC = React.memo(() => {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-black">
      {/* Pure AMOLED Black Base */}
      <div className="absolute inset-0 bg-black" />

      {/* Subtle fluid reflection at the top, fading completely into AMOLED black without GPU blur penalty */}
      <div
        className="absolute -top-40 left-1/4 w-[750px] h-[550px] rounded-full animate-liquid-1 transform-gpu will-change-transform pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(225,29,72,0.08) 0%, rgba(190,18,60,0.03) 40%, transparent 70%)',
        }}
      />

      <div
        className="absolute top-20 -right-20 w-[600px] h-[500px] rounded-full animate-liquid-2 transform-gpu will-change-transform pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, rgba(244,63,94,0.06) 0%, rgba(225,29,72,0.02) 45%, transparent 70%)',
        }}
      />

      {/* Pure AMOLED gradient fade towards bottom */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/80 to-black pointer-events-none" />
    </div>
  );
});

