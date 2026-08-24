import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Pause, Play, Send, Trash2 } from 'lucide-react';

type RecorderMode = 'recording' | 'paused' | 'preview';

const MAX_LEVEL_SAMPLES = 300;
const MAX_RECORDING_SECONDS = 300; // 5 minutes max to prevent runaway recording & memory crashes

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(safe / 60)).padStart(2, '0');
  const ss = String(safe % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

interface VoiceRecorderBarProps {
  onCancel: () => void;
  /** Receives a data URL of the finished recording plus its duration in seconds. */
  onSend: (mediaUrl: string, durationSeconds: number) => void;
}

export const VoiceRecorderBar: React.FC<VoiceRecorderBarProps> = ({ onCancel, onSend }) => {
  const [mode, setMode] = useState<RecorderMode>('recording');
  const [elapsed, setElapsed] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const [isPreparingSend, setIsPreparingSend] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const levelsRef = useRef<number[]>([]);
  const elapsedRef = useRef(0);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const dataUrlRef = useRef<string | null>(null);
  const mimeTypeRef = useRef<string>('audio/webm');

  // Cached canvas rect & theme colors to avoid expensive getBoundingClientRect/getComputedStyle inside rAF
  const cachedRectRef = useRef<{ width: number; height: number }>({ width: 240, height: 32 });
  const cachedColorsRef = useRef<{ accent: string; idle: string; danger: string }>({
    accent: '#0D9488',
    idle: 'rgba(255,255,255,0.26)',
    danger: '#EF4444',
  });

  const updateCachedColors = useCallback(() => {
    const styles = getComputedStyle(document.documentElement);
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    cachedColorsRef.current = {
      accent: styles.getPropertyValue('--color-accent').trim() || '#0D9488',
      idle: dark ? 'rgba(255,255,255,0.26)' : 'rgba(15,23,42,0.2)',
      danger: styles.getPropertyValue('--color-error').trim() || '#EF4444',
    };
  }, []);

  // Update canvas bounds observer
  useEffect(() => {
    updateCachedColors();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          cachedRectRef.current = {
            width: entry.contentRect.width || 240,
            height: entry.contentRect.height || 32,
          };
        }
      }
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [updateCachedColors]);

  /** Static waveform render used in preview mode. */
  const paintStatic = useCallback(
    (progress: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const { width: rectW, height: rectH } = cachedRectRef.current;
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.floor(rectW * dpr));
      const h = Math.max(1, Math.floor(rectH * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.clearRect(0, 0, w, h);

      const levels = levelsRef.current.length > 0 ? levelsRef.current : [0.3];
      const targetBars = Math.min(48, Math.max(12, Math.floor(w / (5 * dpr))));
      const bucketSize = Math.max(1, Math.ceil(levels.length / targetBars));
      const bars: number[] = [];
      for (let i = 0; i < levels.length; i += bucketSize) {
        let peak = 0;
        for (let j = i; j < Math.min(i + bucketSize, levels.length); j++) {
          peak = Math.max(peak, levels[j]);
        }
        bars.push(Math.max(0.1, peak));
      }

      const colors = cachedColorsRef.current;
      const gap = 2 * dpr;
      const barW = Math.max(dpr, (w - gap * (bars.length - 1)) / bars.length);
      const midY = h / 2;
      const maxH = h - 2 * dpr;
      const playX = Math.min(1, Math.max(0, progress)) * w;

      for (let i = 0; i < bars.length; i++) {
        const x = i * (barW + gap);
        const barH = Math.max(3 * dpr, bars[i] * maxH);
        ctx.fillStyle = x + barW / 2 <= playX ? colors.accent : colors.idle;
        ctx.beginPath();
        ctx.roundRect(x, midY - barH / 2, barW, barH, Math.min(barW / 2, 2 * dpr));
        ctx.fill();
      }
    },
    []
  );

  /** Live scrolling frequency visualization while recording (uses cached layout bounds). */
  const startLiveLoop = useCallback(() => {
    const loop = () => {
      const analyser = analyserRef.current;
      const canvas = canvasRef.current;
      if (!analyser || !canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);

      let sum = 0;
      const usable = Math.min(data.length, 64);
      for (let i = 2; i < usable; i++) sum += data[i];
      const level = Math.min(1, (sum / ((usable - 2) * 255)) * 2.4);

      levelsRef.current.push(level);
      if (levelsRef.current.length > MAX_LEVEL_SAMPLES) levelsRef.current.shift();

      const { width: rectW, height: rectH } = cachedRectRef.current;
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.floor(rectW * dpr));
      const h = Math.max(1, Math.floor(rectH * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      ctx.clearRect(0, 0, w, h);

      const visible = Math.min(48, Math.max(12, Math.floor(w / (5 * dpr))));
      const recent = levelsRef.current.slice(-visible);
      const gap = 2 * dpr;
      const barW = Math.max(dpr, (w - gap * (recent.length - 1)) / recent.length);
      const midY = h / 2;
      const maxH = h - 2 * dpr;
      const colors = cachedColorsRef.current;

      for (let i = 0; i < recent.length; i++) {
        const x = w - (recent.length - i) * (barW + gap);
        const barH = Math.max(3 * dpr, recent[i] * maxH);
        ctx.fillStyle = colors.danger;
        ctx.beginPath();
        ctx.roundRect(x, midY - barH / 2, barW, barH, Math.min(barW / 2, 2 * dpr));
        ctx.fill();
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    if (rafRef.current === null) {
      rafRef.current = requestAnimationFrame(loop);
    }
  }, []);

  const stopLiveLoop = useCallback(() => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
  }, []);

  useEffect(() => {
    if (mode !== 'preview') return;
    paintStatic(previewDuration > 0 ? previewTime / previewDuration : 0);
  }, [mode, previewTime, previewDuration, paintStatic]);

  // ── Recording lifecycle ─────────────────────────────────────────────────

  const stopCapture = useCallback(() => {
    stopLiveLoop();
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try {
        recorderRef.current.stop();
      } catch {
        // already stopped
      }
    }
  }, [stopLiveLoop]);

  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        // Choose lightweight speech-optimized mime & audio bit rate (24kbps speech preset)
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/webm';
        mimeTypeRef.current = mimeType;

        const options: MediaRecorderOptions = {
          mimeType,
          audioBitsPerSecond: 24000, // 24 kbps speech optimization -> 90% lighter payloads
        };

        const recorder = new MediaRecorder(stream, options);
        chunksRef.current = [];
        recorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
        };
        recorder.start(250);
        recorderRef.current = recorder;

        const AudioCtor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AudioCtor) {
          const audioCtx = new AudioCtor();
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 256;
          analyser.smoothingTimeConstant = 0.75;
          source.connect(analyser);
          audioCtxRef.current = audioCtx;
          analyserRef.current = analyser;
        }

        timerRef.current = window.setInterval(() => {
          elapsedRef.current += 1;
          setElapsed(elapsedRef.current);
          if (elapsedRef.current >= MAX_RECORDING_SECONDS) {
            handleStopToPreview();
          }
        }, 1000);

        startLiveLoop();
      } catch {
        setMicError('Microphone access is required to record voice notes.');
      }
    };

    void start();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const teardownMedia = useCallback(() => {
    stopCapture();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    analyserRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
    }
    audioCtxRef.current = null;
  }, [stopCapture]);

  useEffect(() => {
    return () => {
      teardownMedia();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePause = () => {
    const recorder = recorderRef.current;
    if (!recorder) return;

    if (mode === 'recording') {
      try {
        recorder.pause();
      } catch {
        return;
      }
      audioCtxRef.current?.suspend().catch(() => {});
      if (timerRef.current !== null) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      stopLiveLoop();
      setMode('paused');
    } else if (mode === 'paused') {
      try {
        recorder.resume();
      } catch {
        return;
      }
      audioCtxRef.current?.resume().catch(() => {});
      timerRef.current = window.setInterval(() => {
        elapsedRef.current += 1;
        setElapsed(elapsedRef.current);
        if (elapsedRef.current >= MAX_RECORDING_SECONDS) {
          handleStopToPreview();
        }
      }, 1000);
      startLiveLoop();
      setMode('recording');
    }
  };

  const handleCancel = () => {
    previewAudioRef.current?.pause();
    teardownMedia();
    onCancel();
  };

  /** Stop capture and switch to pre-send preview. */
  const handleStopToPreview = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    stopLiveLoop();
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    audioCtxRef.current?.suspend().catch(() => {});

    recorder.onstop = () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      analyserRef.current = null;
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }

      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || 'audio/webm' });
      if (blob.size === 0) {
        handleCancel();
        return;
      }
      const url = URL.createObjectURL(blob);
      setPreviewUrl(url);
      setMode('preview');

      // Asynchronously load data URL payload
      const reader = new FileReader();
      reader.onload = () => {
        dataUrlRef.current = reader.result as string;
      };
      reader.readAsDataURL(blob);
    };

    try {
      recorder.stop();
    } catch {
      handleCancel();
    }
  };

  const handleSeekPreview = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const audio = previewAudioRef.current;
    const canvas = canvasRef.current;
    if (!audio || !canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      audio.currentTime = ratio * audio.duration;
      setPreviewTime(audio.currentTime);
    }
  };

  const handleSend = async () => {
    if (isPreparingSend) return;
    setIsPreparingSend(true);

    let payload = dataUrlRef.current;
    if (!payload && chunksRef.current.length > 0) {
      const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current || 'audio/webm' });
      payload = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    }

    if (!payload) {
      handleCancel();
      return;
    }

    previewAudioRef.current?.pause();
    teardownMedia();
    onSend(payload, Math.max(1, elapsedRef.current));
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (micError) {
    return (
      <div className="vn-recorder" role="alert">
        <span className="vn-status-label">{micError}</span>
        <button type="button" className="vn-btn vn-btn--danger" onClick={handleCancel} aria-label="Close">
          <Trash2 size={17} />
        </button>
      </div>
    );
  }

  if (mode === 'preview') {
    return (
      <div className="vn-recorder">
        <button
          type="button"
          className={`vn-btn ${previewPlaying ? '' : 'vn-btn--primary'}`}
          onClick={() => {
            const audio = previewAudioRef.current;
            if (!audio) return;
            if (audio.paused) {
              void audio.play().catch(() => setPreviewPlaying(false));
            } else {
              audio.pause();
            }
          }}
          aria-label={previewPlaying ? 'Pause preview' : 'Play preview'}
        >
          {previewPlaying ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 2 }} />}
        </button>

        <span className="vn-time">{formatClock(previewTime)}</span>

        <canvas ref={canvasRef} className="vn-wave" onClick={handleSeekPreview} aria-label="Recorded waveform — click to seek" />

        <span className="vn-time">{formatClock(previewDuration || elapsed)}</span>

        <button type="button" className="vn-btn vn-btn--danger" onClick={handleCancel} aria-label="Discard recording">
          <Trash2 size={17} />
        </button>

        <button
          type="button"
          className="vn-btn vn-btn--primary"
          onClick={() => void handleSend()}
          disabled={isPreparingSend}
          aria-label="Send voice note"
        >
          <Send size={16} />
        </button>

        {previewUrl && (
          <audio
            ref={previewAudioRef}
            src={previewUrl}
            hidden
            onLoadedMetadata={(e) => {
              const value = e.currentTarget.duration;
              if (Number.isFinite(value) && value > 0) setPreviewDuration(value);
            }}
            onPlay={() => setPreviewPlaying(true)}
            onPause={() => setPreviewPlaying(false)}
            onEnded={(e) => {
              setPreviewPlaying(false);
              e.currentTarget.currentTime = 0;
              setPreviewTime(0);
            }}
            onTimeUpdate={(e) => setPreviewTime(e.currentTarget.currentTime)}
          />
        )}
      </div>
    );
  }

  // recording | paused
  return (
    <div className="vn-recorder">
      <span className={`vn-dot ${mode === 'paused' ? 'paused' : ''}`} aria-hidden="true" />

      <span className="vn-time">{formatClock(elapsed)}</span>

      <span className="vn-status-label">
        {mode === 'paused' ? 'Paused' : 'Recording…'}
      </span>

      <canvas ref={canvasRef} className="vn-wave" aria-hidden="true" />

      <button
        type="button"
        className="vn-btn"
        onClick={togglePause}
        aria-label={mode === 'paused' ? 'Resume recording' : 'Pause recording'}
      >
        {mode === 'paused' ? <Mic size={16} /> : <Pause size={16} />}
      </button>

      <button type="button" className="vn-btn vn-btn--danger" onClick={handleCancel} aria-label="Discard recording">
        <Trash2 size={17} />
      </button>

      <button type="button" className="vn-btn vn-btn--primary" onClick={handleStopToPreview} aria-label="Finish and preview">
        <Send size={16} />
      </button>
    </div>
  );
};

export default VoiceRecorderBar;

