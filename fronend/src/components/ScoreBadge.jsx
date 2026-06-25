import { useEffect, useState } from 'react';

function ScoreBadge({ score }) {
  const [offset, setOffset] = useState(283); // Circumference of circle with r=45 (2 * PI * r)
  
  // Clean score value
  const numericScore = typeof score === 'number' ? score : 0;
  const percentage = (numericScore / 10) * 100;
  const circumference = 2 * Math.PI * 45;

  useEffect(() => {
    // Micro-animation delay
    const timer = setTimeout(() => {
      const progressOffset = circumference - (percentage / 100) * circumference;
      setOffset(progressOffset);
    }, 100);
    return () => clearTimeout(timer);
  }, [percentage, circumference]);

  // Color mappings based on score
  let strokeColor = 'var(--color-danger)';
  let glowColor = 'rgba(239, 68, 68, 0.4)';
  let scoreClass = 'text-danger';

  if (numericScore >= 8) {
    strokeColor = 'var(--color-success)';
    glowColor = 'rgba(16, 185, 129, 0.4)';
    scoreClass = 'text-success';
  } else if (numericScore >= 5) {
    strokeColor = 'var(--color-warning)';
    glowColor = 'rgba(245, 158, 11, 0.4)';
    scoreClass = 'text-warning';
  }

  return (
    <div className="score-badge-container">
      <svg className="score-badge-svg" width="120" height="120" viewBox="0 0 120 120">
        <defs>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        {/* Background Track Circle */}
        <circle
          cx="60"
          cy="60"
          r="45"
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth="8"
        />
        
        {/* Animated Progress Circle */}
        <circle
          cx="60"
          cy="60"
          r="45"
          fill="none"
          stroke={strokeColor}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
          style={{
            transition: 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)',
            filter: `drop-shadow(0 0 4px ${glowColor})`
          }}
        />
      </svg>
      
      {/* Inner Score Text */}
      <div className={`score-badge-text-overlay ${scoreClass}`}>
        <span className="score-number">{numericScore}</span>
        <span className="score-slash">/</span>
        <span className="score-total">10</span>
      </div>

      <style>{`
        .score-badge-container {
          position: relative;
          width: 120px;
          height: 120px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto;
        }
        
        .score-badge-svg {
          display: block;
        }

        .score-badge-text-overlay {
          position: absolute;
          display: flex;
          align-items: baseline;
          justify-content: center;
          font-family: var(--font-heading);
          font-weight: 700;
        }

        .score-number {
          font-size: 2.2rem;
          line-height: 1;
        }

        .score-slash {
          font-size: 1.1rem;
          opacity: 0.5;
          margin: 0 1px;
          color: var(--text-muted);
        }

        .score-total {
          font-size: 1.1rem;
          opacity: 0.6;
          color: var(--text-muted);
        }

        .text-success { color: var(--color-success); }
        .text-warning { color: var(--color-warning); }
        .text-danger { color: var(--color-danger); }
      `}</style>
    </div>
  );
}

export default ScoreBadge;
