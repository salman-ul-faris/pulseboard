import React from 'react';

export default function BackgroundWave() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {/* Background ambient radial gradients */}
      <div
        style={{
          position: 'absolute',
          top: '-20%',
          left: '20%',
          width: '60vw',
          height: '60vw',
          maxWidth: '650px',
          maxHeight: '650px',
          background: 'radial-gradient(circle, rgba(56, 242, 165, 0.08) 0%, rgba(84, 200, 232, 0.03) 40%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(50px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '-15%',
          right: '10%',
          width: '50vw',
          height: '50vw',
          maxWidth: '500px',
          maxHeight: '500px',
          background: 'radial-gradient(circle, rgba(84, 200, 232, 0.06) 0%, rgba(56, 242, 165, 0.02) 50%, transparent 70%)',
          borderRadius: '50%',
          filter: 'blur(60px)',
        }}
      />

      {/* Flowing animated green wave lines */}
      <svg
        viewBox="0 0 1440 800"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '70%',
          opacity: 0.65,
        }}
      >
        <defs>
          <linearGradient id="waveGrad1" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38F2A5" stopOpacity="0.02" />
            <stop offset="30%" stopColor="#38F2A5" stopOpacity="0.25" />
            <stop offset="70%" stopColor="#54C8E8" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#38F2A5" stopOpacity="0.05" />
          </linearGradient>

          <linearGradient id="waveGrad2" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#54C8E8" stopOpacity="0.02" />
            <stop offset="45%" stopColor="#38F2A5" stopOpacity="0.2" />
            <stop offset="85%" stopColor="#38F2A5" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#54C8E8" stopOpacity="0.01" />
          </linearGradient>

          <linearGradient id="waveGrad3" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#38F2A5" stopOpacity="0.01" />
            <stop offset="50%" stopColor="#38F2A5" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#54C8E8" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* Wave Path 1 */}
        <path
          d="M-50,550 C250,420 450,680 750,520 C1050,360 1250,580 1500,480"
          stroke="url(#waveGrad1)"
          strokeWidth="1.75"
          strokeLinecap="round"
          className="wave-line-1"
        />

        {/* Wave Path 2 */}
        <path
          d="M-50,600 C300,490 520,710 820,570 C1120,430 1300,640 1500,530"
          stroke="url(#waveGrad2)"
          strokeWidth="1.5"
          strokeLinecap="round"
          className="wave-line-2"
        />

        {/* Wave Path 3 */}
        <path
          d="M-50,490 C220,380 400,600 700,460 C1000,320 1200,520 1500,430"
          stroke="url(#waveGrad3)"
          strokeWidth="1"
          strokeDasharray="4 4"
          className="wave-line-3"
        />
      </svg>

      <style>{`
        @keyframes floatWave1 {
          0%, 100% { transform: translateY(0px) scaleY(1); }
          50% { transform: translateY(-16px) scaleY(1.03); }
        }
        @keyframes floatWave2 {
          0%, 100% { transform: translateY(0px) scaleY(1); }
          50% { transform: translateY(14px) scaleY(0.97); }
        }
        .wave-line-1 {
          animation: floatWave1 12s ease-in-out infinite;
        }
        .wave-line-2 {
          animation: floatWave2 15s ease-in-out infinite;
        }
        .wave-line-3 {
          animation: floatWave1 18s ease-in-out infinite reverse;
        }
        @media (prefers-reduced-motion: reduce) {
          .wave-line-1, .wave-line-2, .wave-line-3 {
            animation: none !important;
          }
        }
        .reduced-motion .wave-line-1, 
        .reduced-motion .wave-line-2, 
        .reduced-motion .wave-line-3 {
          animation: none !important;
        }
      `}</style>
    </div>
  );
}
