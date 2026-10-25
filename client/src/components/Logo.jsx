import React from 'react';

export default function Logo({ size = 'medium', showWordmark = true, className = '' }) {
  const dimensions = {
    small: { icon: 26, font: '1rem', gap: '8px' },
    medium: { icon: 34, font: '1.25rem', gap: '10px' },
    large: { icon: 44, font: '1.65rem', gap: '14px' },
  }[size] || { icon: 34, font: '1.25rem', gap: '10px' };

  return (
    <div 
      className={`pulseboard-brand ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: dimensions.gap,
        userSelect: 'none',
      }}
    >
      <svg
        width={dimensions.icon}
        height={dimensions.icon}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ flexShrink: 0 }}
      >
        <rect
          width="40"
          height="40"
          rx="10"
          fill="#0C1628"
          stroke="rgba(56, 242, 165, 0.3)"
          strokeWidth="1.5"
        />
        {/* Subtle geometric board grid */}
        <line x1="20" y1="8" x2="20" y2="32" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" strokeDasharray="2 2" />
        <line x1="8" y1="20" x2="32" y2="20" stroke="rgba(255, 255, 255, 0.08)" strokeWidth="1" strokeDasharray="2 2" />
        <rect x="10" y="10" width="8" height="8" rx="2" fill="rgba(84, 200, 232, 0.12)" />
        <rect x="22" y="22" width="8" height="8" rx="2" fill="rgba(56, 242, 165, 0.12)" />

        {/* Pulse Wave Element */}
        <path
          d="M7 20h7l2.5-7 4.5 14 3.5-9 2.5 2H33"
          stroke="url(#pulse_mint_gradient)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Pulse glow node */}
        <circle cx="21" cy="27" r="2" fill="#38F2A5" filter="drop-shadow(0 0 4px #38F2A5)" />

        <defs>
          <linearGradient id="pulse_mint_gradient" x1="7" y1="13" x2="33" y2="27" gradientUnits="userSpaceOnUse">
            <stop stopColor="#54C8E8" />
            <stop offset="0.6" stopColor="#38F2A5" />
            <stop offset="1" stopColor="#38F2A5" />
          </linearGradient>
        </defs>
      </svg>

      {showWordmark && (
        <span
          style={{
            fontSize: dimensions.font,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            display: 'flex',
            alignItems: 'center',
            color: '#F3F7FC',
          }}
        >
          Pulse
          <span style={{ color: '#38F2A5', fontWeight: 600 }}>Board</span>
          <span style={{ color: '#54C8E8', marginLeft: '1px' }}>.</span>
        </span>
      )}
    </div>
  );
}
