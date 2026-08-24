import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import './VoiceNote.css';


const SPEEDS = [1, 1.5, 2] as const;
const BAR_COUNT = 44;

/** Parse "0:45" / "00:45" / "45s" hints into seconds (0 when unparseable). */
export function parseDurationHint(hint?: string | null): number {
  if (!hint) return 0;
  const match = hint.trim().match(/^(?:(\d+):)?(\d{1,2})$/);
  if (!match) return 0;
  return (Number(match[1]) || 0) * 60 + Number(match[2]);
}

function formatTime(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? Math.floor(totalSeconds) : 0;
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Deterministic PRNG so a given message always renders the same waveform. */
function seededBars(seed: string, count: number): number[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let state = h >>> 0;
  const next = () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return Array.from({ length: count }, (_, i) => {
    const envelope = Math.sin((i / (count - 1)) * Math.PI) * 0.7 + 0.3;
    return Math.max(0.14, next() * envelope);
  });
}

interface VoiceNotePlayerProps {
  mediaUrl?: string | null;
  /** Stable id used to seed the deterministic waveform shape. */
  seedId: string;
  /** Optional "m:ss"/"mm:ss" hint shown before audio metadata loads. */
  durationHint?: string | null;
}

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({ mediaUrl, seedId, durationHint }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);

  const parsedHint = useMemo(() => parseDurationHint(durationHint), [durationHint]);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(parsedHint);
  const [speedIdx, setSpeedIdx] = useState(0);

  const durationRef = useRef(duration);
  durationRef.current = duration;

  const bars = useMemo(() => seededBars(seedId || 'voice', BAR_COUNT), [seedId]);
  const speed = SPEEDS[speedIdx];

  const cachedRectRef = useRef<{ width: number; height: number }>({ width: 220, height: 32 });
  const cachedColorsRef = useRef<{ played: string; idle: string }>({
    played: '#0D9488',
    idle: 'rgba(15,23,42,0.22)',
  });

  const updateColors = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const styles = getComputedStyle(document.documentElement);
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    cachedColorsRef.current = {
      played: styles.getPropertyValue('--color-accent').trim() || '#0D9488',
      idle: dark ? 'rgba(255,255,255,0.28)' : 'rgba(15,23,42,0.22)',
    };
  }, []);

  const drawWaveformDirect = useCallback(
    (curTime: number, totalDur: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { width: rectW, height: rectH } = cachedRectRef.current;
      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.max(1, Math.floor(rectW * dpr));
      const targetH = Math.max(1, Math.floor(rectH * dpr));

      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      ctx.clearRect(0, 0, targetW, targetH);

      const barCount = bars.length;
      const gap = 2 * dpr;
      const barWidth = Math.max(dpr, (targetW - gap * (barCount - 1)) / barCount);
      const midY = targetH / 2;
      const maxBarH = targetH - 2 * dpr;

      const progress = totalDur > 0 ? Math.min(1, Math.max(0, curTime / totalDur)) : 0;
      const playX = progress * targetW;
      const { played: playedColor, idle: idleColor } = cachedColorsRef.current;

      for (let i = 0; i < barCount; i++) {
        const x = i * (barWidth + gap);
        const barH = Math.max(3 * dpr, bars[i] * maxBarH);
        const y = midY - barH / 2;
        ctx.fillStyle = x + barWidth / 2 <= playX ? playedColor : idleColor;
        ctx.beginPath();
        const radius = Math.min(barWidth / 2, 2 * dpr);
        ctx.roundRect(x, y, barWidth, barH, radius);
        ctx.fill();
      }
    },
    [bars]
  );

  // ResizeObserver to cache canvas size & redraw
  useEffect(() => {
    updateColors();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          cachedRectRef.current = {
            width: entry.contentRect.width || 220,
            height: entry.contentRect.height || 32,
          };
          drawWaveformDirect(audioRef.current?.currentTime || currentTime, durationRef.current);
        }
      }
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [drawWaveformDirect, updateColors, currentTime]);

  // Sync canvas when state changes
  useEffect(() => {
    drawWaveformDirect(currentTime, duration);
  }, [currentTime, duration, drawWaveformDirect]);

  // Smooth direct-canvas animation while playing without triggering 60fps React re-renders
  useEffect(() => {
    if (!playing) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    const tick = () => {
      const audio = audioRef.current;
      if (audio) {
        drawWaveformDirect(audio.currentTime, durationRef.current);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [playing, drawWaveformDirect]);

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio || !mediaUrl) return;
    if (audio.paused) {
      audio.playbackRate = speed;
      void audio.play().catch(() => setPlaying(false));
    } else {
      audio.pause();
    }
  };

  const handleSeek = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const audio = audioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas || !(duration > 0)) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const targetTime = ratio * duration;
    audio.currentTime = targetTime;
    setCurrentTime(targetTime);
    drawWaveformDirect(targetTime, duration);
  };

  const cycleSpeed = () => setSpeedIdx((i) => (i + 1) % SPEEDS.length);

  return (
    <div className="vnp">
      <button
        type="button"
        className={`vnp-toggle ${playing ? 'is-playing' : ''}`}
        onClick={togglePlay}
        aria-label={playing ? 'Pause voice note' : 'Play voice note'}
        disabled={!mediaUrl}
      >
        {playing ? <Pause size={17} /> : <Play size={17} style={{ marginLeft: 2 }} />}
      </button>

      <div className="vnp-body">
        <canvas ref={canvasRef} className="vnp-wave" onClick={handleSeek} aria-label="Voice note waveform — click to seek" />
        <div className="vnp-meta">
          <span className="vnp-timestamps">
            {formatTime(currentTime)} / {formatTime(duration || parsedHint)}
          </span>
          <button type="button" className="vnp-speed" onClick={cycleSpeed} aria-label={`Playback speed ${speed}x`}>
            {speed}x
          </button>
        </div>
      </div>

      {mediaUrl && (
        <audio
          ref={audioRef}
          src={mediaUrl}
          preload="metadata"
          hidden
          onLoadedMetadata={(e) => {
            const rawDuration = e.currentTarget.duration;
            if (Number.isFinite(rawDuration) && rawDuration > 0) {
              setDuration(rawDuration);
            } else if (parsedHint > 0) {
              setDuration(parsedHint);
            }
          }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={(e) => {
            setPlaying(false);
            e.currentTarget.currentTime = 0;
            setCurrentTime(0);
            drawWaveformDirect(0, durationRef.current);
          }}
          onTimeUpdate={(e) => {
            setCurrentTime(e.currentTarget.currentTime);
          }}
        />
      )}
    </div>
  );
};

export default VoiceNotePlayer;

