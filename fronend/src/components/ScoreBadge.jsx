import { useEffect, useState } from 'react';

function ScoreBadge({ score, size = 72 }) {
  const circumference = 2 * Math.PI * 28;
  const numericScore = typeof score === 'number' ? score : 0;
  const percentage = (numericScore / 10) * 100;
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(circumference - (percentage / 100) * circumference);
    }, 80);
    return () => clearTimeout(timer);
  }, [percentage, circumference]);

  let strokeColor = '#f14c4c';   // red
  let textColor   = '#f14c4c';
  if (numericScore >= 8) {
    strokeColor = '#4ec9b0'; textColor = '#4ec9b0';  // green
  } else if (numericScore >= 5) {
    strokeColor = '#cca700'; textColor = '#cca700';  // yellow
  }

  return (
    <div style={{
      position: 'relative',
      width: size,
      height: size,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }}>
      <svg width={size} height={size} viewBox="0 0 72 72">
        {/* bg track */}
        <circle cx="36" cy="36" r="28" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
        {/* progress arc */}
        <circle
          cx="36" cy="36" r="28"
          fill="none"
          stroke={strokeColor}
          strokeWidth="5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 36 36)"
          style={{
            transition: 'stroke-dashoffset 0.9s cubic-bezier(0.4,0,0.2,1)',
            filter: `drop-shadow(0 0 3px ${strokeColor})`
          }}
        />
      </svg>
      {/* centre text */}
      <div style={{
        position: 'absolute',
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'center',
        color: textColor,
        fontFamily: 'var(--font-ide)',
        fontWeight: 700,
        gap: 1
      }}>
        <span style={{ fontSize: size * 0.32, lineHeight: 1 }}>{numericScore}</span>
        <span style={{ fontSize: size * 0.17, opacity: 0.5, color: '#858585' }}>/10</span>
      </div>
    </div>
  );
}

export default ScoreBadge;
