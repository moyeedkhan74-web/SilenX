interface MediaProgressRingProps {
  progress: number; // 0-100
  onCancel?: () => void;
  size?: number;
}

export function MediaProgressRing({ progress, onCancel, size = 56 }: MediaProgressRingProps) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="media-progress-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={3}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#1D9E75"
          strokeWidth={3}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.2s linear' }}
        />
      </svg>
      {onCancel && (
        <button className="media-progress-cancel" onClick={onCancel} aria-label="Cancel upload">
          <i className="ti ti-x" />
        </button>
      )}
    </div>
  );
}