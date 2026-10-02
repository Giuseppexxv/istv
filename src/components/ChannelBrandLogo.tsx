import React from 'react';

interface ChannelBrandLogoProps {
  name: string;
  logo?: string;
  className?: string;
}

export const ChannelBrandLogo: React.FC<ChannelBrandLogoProps> = ({
  name,
  className = 'h-10 w-full',
}) => {
  const n = (name || '').toLowerCase().trim();

  // 1. DAZN
  if (n.includes('dazn')) {
    const isNum1 = n.includes('1');
    return (
      <div className={`flex items-center justify-center select-none ${className}`}>
        <svg viewBox="0 0 150 42" className="h-8 w-auto max-w-full drop-shadow-sm">
          <rect x="2" y="2" width="146" height="38" rx="8" fill="#121318" stroke="#facc15" strokeWidth="1.8" />
          <g fill="#facc15">
            {/* D */}
            <path d="M22 11h11c7.5 0 13 4.5 13 10s-5.5 10-13 10H22V11zm7 15.5h4c4 0 6-2 6-5.5s-2-5.5-6-5.5h-4v11z" />
            {/* A */}
            <path d="M58 11h6.5l9 20h-6.8l-1.5-4.2H56.3l-1.5 4.2h-6.8L58 11zm3.8 11.5l-2.1-5.8-2.1 5.8h4.2z" />
            {/* Z */}
            <path d="M80 11h16v4.6l-9.2 10.8h9.2V31H80v-4.6l9.2-10.8H80V11z" />
            {/* N */}
            <path d="M102 11h6.8l8.5 12.5V11h6.5v20h-6.5l-8.8-12.5V31H102V11z" />
          </g>
          {isNum1 && (
            <g transform="translate(130, 5)">
              <rect width="14" height="13" rx="2.5" fill="#facc15" />
              <text x="7" y="10.2" fill="#000000" fontSize="10" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">1</text>
            </g>
          )}
        </svg>
      </div>
    );
  }

  // 2. SPORTITALIA
  if (n.includes('sportitalia')) {
    const isSoloCalcio = n.includes('solocalcio') || n.includes('solo calcio');
    const isPlus = n.includes('plus');
    return (
      <div className={`flex items-center justify-center select-none ${className}`}>
        <svg viewBox="0 0 176 42" className="h-8 w-auto max-w-full drop-shadow-sm">
          <rect x="2" y="2" width="172" height="38" rx="8" fill="#180407" stroke="#dc2626" strokeWidth="1.6" />
          <text x="14" y="27.5" fill="#ffffff" fontFamily="Impact, Arial Black, sans-serif" fontStyle="italic" fontSize="21" letterSpacing="0.5">
            SPORT
          </text>
          <text x="86" y="27.5" fill="#ef4444" fontFamily="Impact, Arial Black, sans-serif" fontStyle="italic" fontSize="21" letterSpacing="0.5">
            ITALIA
          </text>
          {isSoloCalcio && (
            <g transform="translate(118, 5)">
              <rect width="52" height="13" rx="3" fill="#f59e0b" />
              <text x="26" y="9.8" fill="#000" fontSize="7.5" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">SOLOCALCIO</text>
            </g>
          )}
          {isPlus && (
            <g transform="translate(130, 5)">
              <rect width="38" height="13" rx="3" fill="#06b6d4" />
              <text x="19" y="10" fill="#000" fontSize="8" fontWeight="900" textAnchor="middle" fontFamily="sans-serif">PLUS</text>
            </g>
          )}
        </svg>
      </div>
    );
  }

  // 3. CARTOON NETWORK & CARTOONITO
  if (n.includes('cartoon network')) {
    return (
      <div className={`flex items-center justify-center select-none ${className}`}>
        <svg viewBox="0 0 156 42" className="h-8 w-auto max-w-full drop-shadow-sm">
          {/* C Box */}
          <rect x="4" y="4" width="34" height="34" rx="5" fill="#ffffff" stroke="#000000" strokeWidth="1.5" />
          <text x="13" y="30" fill="#000000" fontFamily="Arial Black, Impact, sans-serif" fontWeight="900" fontSize="26">
            C
          </text>
          {/* N Box */}
          <rect x="42" y="4" width="34" height="34" rx="5" fill="#000000" stroke="#ffffff" strokeWidth="1.5" />
          <text x="51" y="30" fill="#ffffff" fontFamily="Arial Black, Impact, sans-serif" fontWeight="900" fontSize="26">
            N
          </text>
          {/* CARTOON NETWORK text */}
          <text x="84" y="20" fill="#ffffff" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="9" letterSpacing="0.5">
            CARTOON
          </text>
          <text x="84" y="33" fill="#38bdf8" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="9" letterSpacing="0.5">
            NETWORK
          </text>
        </svg>
      </div>
    );
  }

  if (n.includes('cartoonito')) {
    return (
      <div className={`flex items-center justify-center select-none ${className}`}>
        <svg viewBox="0 0 160 40" className="h-8 w-auto max-w-full drop-shadow-sm">
          <rect x="2" y="2" width="156" height="36" rx="18" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
          <text x="80" y="26" textAnchor="middle" fill="#ffffff" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="16" letterSpacing="1.5">
            CARTOONITO
          </text>
        </svg>
      </div>
    );
  }

  // 4. DISNEY+ / DISNEY
  if (n.includes('disney')) {
    return (
      <div className={`flex items-center justify-center select-none ${className}`}>
        <svg viewBox="0 0 150 42" className="h-8 w-auto max-w-full drop-shadow-sm">
          <rect x="2" y="2" width="146" height="38" rx="8" fill="#0c1024" stroke="rgba(99,102,241,0.4)" strokeWidth="1.5" />
          <path d="M 16 31 Q 65 6 128 16" fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" />
          <text x="20" y="29" fill="#ffffff" fontFamily="Georgia, Times New Roman, serif" fontStyle="italic" fontWeight="bold" fontSize="21" letterSpacing="0.5">
            Disney
          </text>
          <text x="98" y="30" fill="#38bdf8" fontFamily="Arial, sans-serif" fontWeight="900" fontSize="24">
            +
          </text>
          {n.includes('film') && (
            <text x="120" y="26" fill="#a5b4fc" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="7.5" letterSpacing="0.5">
              FILM
            </text>
          )}
        </svg>
      </div>
    );
  }

  // 5. TV8 (Uniformed under Sky brand)
  if (n.includes('tv8') || n.includes('tv 8')) {
    return (
      <div className={`flex items-center justify-center select-none ${className}`}>
        <svg viewBox="0 0 166 42" className="h-8 w-auto max-w-full drop-shadow-sm">
          <rect x="2" y="2" width="162" height="38" rx="8" fill="#090d1a" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2" />
          {/* Subtle Sky arc */}
          <path d="M 12 12 C 19 7 31 7 38 12" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          <text x="12" y="29" fill="#ffffff" fontFamily="Arial, Helvetica, sans-serif" fontStyle="italic" fontWeight="bold" fontSize="19" letterSpacing="-0.8">
            sky
          </text>
          {/* TV8 Badge */}
          <rect x="48" y="7" width="110" height="28" rx="6" fill="#e11d48" />
          <text x="76" y="26.5" fill="#ffffff" fontFamily="Arial Black, Impact, sans-serif" fontWeight="900" fontSize="15" letterSpacing="0.5">
            TV
          </text>
          <circle cx="126" cy="16" r="4.5" fill="none" stroke="#ffffff" strokeWidth="2.5" />
          <circle cx="126" cy="24" r="5.8" fill="none" stroke="#ffffff" strokeWidth="2.5" />
        </svg>
      </div>
    );
  }

  // 6. CANALE 5 (Mediaset)
  if (n.includes('canale 5') || n.includes('canale5')) {
    return (
      <div className={`flex items-center justify-center select-none ${className}`}>
        <svg viewBox="0 0 156 42" className="h-8 w-auto max-w-full drop-shadow-sm">
          <rect x="4" y="4" width="34" height="34" rx="7" fill="#f97316" />
          <text x="21" y="30" textAnchor="middle" fill="#ffffff" fontFamily="Arial Black, Impact, sans-serif" fontWeight="900" fontSize="24">
            5
          </text>
          <circle cx="31" cy="10" r="3.8" fill="#ffffff" stroke="#ea580c" strokeWidth="1" />
          <circle cx="31" cy="10" r="1.6" fill="#f97316" />
          <text x="46" y="22" fill="#ffffff" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="13" letterSpacing="0.5">
            CANALE 5
          </text>
          <text x="46" y="33" fill="#fed7aa" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="8.5" letterSpacing="1.5">
            MEDIASET
          </text>
        </svg>
      </div>
    );
  }

  // 7. ITALIA 1 (Mediaset)
  if (n.includes('italia 1') || n.includes('italia1')) {
    return (
      <div className={`flex items-center justify-center select-none ${className}`}>
        <svg viewBox="0 0 156 42" className="h-8 w-auto max-w-full drop-shadow-sm">
          <rect x="4" y="4" width="34" height="34" rx="7" fill="#ffffff" stroke="#06b6d4" strokeWidth="1.8" />
          <text x="21" y="31" textAnchor="middle" fill="#0891b2" fontFamily="Arial Black, Impact, sans-serif" fontWeight="900" fontSize="26">
            1
          </text>
          <text x="46" y="22" fill="#ffffff" fontFamily="Arial Black, sans-serif" fontStyle="italic" fontWeight="900" fontSize="13.5" letterSpacing="0.5">
            ITALIA 1
          </text>
          <text x="46" y="33" fill="#a5f3fc" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="8.5" letterSpacing="1.5">
            MEDIASET
          </text>
        </svg>
      </div>
    );
  }

  // 8. RETE 4 (Mediaset)
  if (n.includes('rete 4') || n.includes('rete4')) {
    return (
      <div className={`flex items-center justify-center select-none ${className}`}>
        <svg viewBox="0 0 156 42" className="h-8 w-auto max-w-full drop-shadow-sm">
          <rect x="4" y="4" width="34" height="34" rx="7" fill="#d97706" />
          <text x="21" y="30" textAnchor="middle" fill="#ffffff" fontFamily="Arial Black, Impact, sans-serif" fontWeight="900" fontSize="24">
            4
          </text>
          <text x="46" y="22" fill="#ffffff" fontFamily="Arial Black, sans-serif" fontWeight="900" fontSize="13" letterSpacing="0.5">
            RETE 4
          </text>
          <text x="46" y="33" fill="#fde68a" fontFamily="Arial, sans-serif" fontWeight="bold" fontSize="8.5" letterSpacing="1.5">
            MEDIASET
          </text>
        </svg>
      </div>
    );
  }

  // 9. RAI (Rai 1, Rai 2, Rai 3, Rai 4, Rai 4K, Rai 5, Rai Sport)
  if (n.includes('rai')) {
    let sub = '1';
    let subBg = '#00529c';
    let subTextColor = '#ffffff';

    if (n.includes('2')) {
      sub = '2';
      subBg = '#dc2626';
    } else if (n.includes('3')) {
      sub = '3';
      subBg = '#059669';
    } else if (n.includes('4k')) {
      sub = '4K';
      subBg = '#eab308';
      subTextColor = '#000000';
    } else if (n.includes('4')) {
      sub = '4';
      subBg = '#ea580c';
    } else if (n.includes('5')) {
      sub = '5';
      subBg = '#6366f1';
    } else if (n.includes('sport')) {
      sub = 'SPORT';
      subBg = '#0891b2';
    }

    const isLong = sub.length > 2;

    return (
      <div className={`flex items-center justify-center select-none ${className}`}>
        <svg viewBox={isLong ? "0 0 150 42" : "0 0 110 42"} className="h-8 w-auto max-w-full drop-shadow-sm">
          {/* Rai Left Cube */}
          <rect x="4" y="4" width="48" height="34" rx="7" fill="#00529c" />
          <text x="28" y="28" textAnchor="middle" fill="#ffffff" fontFamily="Georgia, Times New Roman, serif" fontStyle="italic" fontWeight="bold" fontSize="20">
            Rai
          </text>
          {/* Sub Cube */}
          <rect
            x="56"
            y="4"
            width={isLong ? "88" : "48"}
            height="34"
            rx="7"
            fill={subBg}
          />
          <text
            x={isLong ? "100" : "80"}
            y="28"
            textAnchor="middle"
            fill={subTextColor}
            fontFamily="Arial Black, Impact, sans-serif"
            fontWeight="900"
            fontSize={isLong ? "13.5" : "22"}
            letterSpacing={isLong ? "0.5" : "0"}
          >
            {sub}
          </text>
        </svg>
      </div>
    );
  }

  // 10. SKY & SKY PRIMAFILA
  if (n.includes('sky') || n.includes('primafila')) {
    let discipline = 'SPORT';
    let badgeBg = '#0284c7';
    let badgeText = '#ffffff';

    if (n.includes('primafila')) {
      const matchNum = n.match(/\b\d+\b/);
      if (n.includes('premiere')) {
        const premNum = matchNum ? matchNum[0] : '';
        discipline = premNum ? `PREMIERE ${premNum}` : 'PREMIERE';
      } else {
        const pNum = matchNum ? matchNum[0] : '';
        discipline = pNum ? `PRIMAFILA ${pNum}` : 'PRIMAFILA';
      }
      badgeBg = '#d97706';
    } else if (n.includes('f1')) {
      discipline = 'SPORT F1';
      badgeBg = '#dc2626';
    } else if (n.includes('motogp') || n.includes('moto gp')) {
      discipline = 'SPORT MOTOGP';
      badgeBg = '#ea580c';
    } else if (n.includes('calcio')) {
      discipline = 'SPORT CALCIO';
      badgeBg = '#059669';
    } else if (n.includes('uno') && (n.includes('sport') || n.includes('sports'))) {
      discipline = 'SPORT UNO';
      badgeBg = '#0284c7';
    } else if (n.includes('24') && n.includes('sport')) {
      discipline = 'SPORT 24';
      badgeBg = '#0369a1';
    } else if (n.includes('tennis')) {
      discipline = 'SPORT TENNIS';
      badgeBg = '#eab308';
      badgeText = '#000000';
    } else if (n.includes('arena')) {
      discipline = 'SPORT ARENA';
      badgeBg = '#0284c7';
    } else if (n.includes('golf')) {
      discipline = 'SPORT GOLF';
      badgeBg = '#10b981';
    } else if (n.includes('nba')) {
      discipline = 'SPORT NBA';
      badgeBg = '#e11d48';
    } else if (n.includes('max')) {
      discipline = 'SPORT MAX';
      badgeBg = '#06b6d4';
    } else if (n.includes('football')) {
      discipline = 'SPORT FOOTBALL';
      badgeBg = '#059669';
    } else if (n.includes('cinema')) {
      let cin = 'CINEMA';
      if (n.includes('uno')) cin = 'CINEMA UNO';
      else if (n.includes('action')) cin = 'ACTION';
      else if (n.includes('comedy')) cin = 'COMEDY';
      else if (n.includes('family')) cin = 'FAMILY';
      else if (n.includes('drama')) cin = 'DRAMA';
      else if (n.includes('suspense')) cin = 'SUSPENSE';
      else if (n.includes('romance')) cin = 'ROMANCE';
      else if (n.includes('collection')) cin = 'COLLECTION';
      else if (n.includes('due')) cin = 'CINEMA DUE';
      discipline = cin;
      badgeBg = '#d97706';
    } else if (n.includes('tg24') || n.includes('tg 24')) {
      discipline = 'TG24';
      badgeBg = '#dc2626';
    } else if (n.includes('arte')) {
      discipline = 'ARTE';
      badgeBg = '#7c3aed';
    } else if (n.includes('serie')) {
      discipline = 'SERIE';
      badgeBg = '#9333ea';
    } else if (n.includes('atlantic')) {
      discipline = 'ATLANTIC';
      badgeBg = '#0284c7';
    } else if (n.includes('crime')) {
      discipline = 'CRIME';
      badgeBg = '#b91c1c';
    } else if (n.includes('documentaries')) {
      discipline = 'DOC';
      badgeBg = '#0d9488';
    } else if (n.includes('investigation')) {
      discipline = 'INVESTIGATION';
      badgeBg = '#4f46e5';
    } else if (n.includes('uno')) {
      discipline = 'UNO';
      badgeBg = '#2563eb';
    }

    return (
      <div className={`flex items-center justify-center select-none ${className}`}>
        <svg viewBox="0 0 166 42" className="h-8 w-auto max-w-full drop-shadow-sm">
          {/* Clean dark container */}
          <rect x="2" y="2" width="162" height="38" rx="8" fill="#090d1a" stroke="rgba(255,255,255,0.15)" strokeWidth="1.2" />
          {/* Subtle Sky rainbow arc */}
          <path d="M 12 12 C 19 7 31 7 38 12" stroke="#f59e0b" strokeWidth="2.2" strokeLinecap="round" fill="none" />
          {/* Sky wordmark */}
          <text x="12" y="29" fill="#ffffff" fontFamily="Arial, Helvetica, sans-serif" fontStyle="italic" fontWeight="bold" fontSize="19" letterSpacing="-0.8">
            sky
          </text>
          {/* Discipline Badge */}
          <rect x="48" y="7" width="110" height="28" rx="6" fill={badgeBg} />
          <text x="103" y="25.5" textAnchor="middle" fill={badgeText} fontFamily="Arial Black, Impact, sans-serif" fontWeight="900" fontSize="9" letterSpacing="0.4">
            {discipline}
          </text>
        </svg>
      </div>
    );
  }

  // Fallback Minimalist Tag
  return (
    <div className={`flex items-center justify-center select-none px-2 ${className}`}>
      <span className="text-xs font-bold text-slate-200 truncate">
        {name}
      </span>
    </div>
  );
};
