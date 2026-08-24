/**
 * Zero-dependency Web Audio API sound-effects synthesizer.
 * No MP3 assets: every effect is generated procedurally, so sounds play with
 * zero latency and work fully offline.
 *
 * Global toggle is persisted in localStorage ('silenx_sound_effects') and
 * mirrored in the settings store (In-App Sound Effects).
 */

const STORAGE_KEY = 'silenx_sound_effects';
const DEFAULT_ENABLED = true;

let audioContext: AudioContext | null = null;

export function areSoundEffectsEnabled(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored !== null ? stored === 'true' : DEFAULT_ENABLED;
  } catch {
    return DEFAULT_ENABLED;
  }
}

export function setSoundEffectsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // storage unavailable — toggle still applies for this session
  }
}

function getContext(): AudioContext | null {
  if (!areSoundEffectsEnabled()) return null;

  try {
    if (!audioContext) {
      const Ctor =
        window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      audioContext = new Ctor();
    }
    if (audioContext.state === 'suspended') {
      void audioContext.resume().catch(() => null);
    }
    return audioContext;
  } catch {
    return null;
  }
}

/** Glassy two-tone pop chime: 880Hz -> 1320Hz sweep with exponential decay. */
export function playIncomingChime(): void {
  const ctx = getContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    // Primary glassy tone
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1320, now + 0.12);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    // Sparkle overtone one octave up, quieter and faster decay
    const harmonic = ctx.createOscillator();
    const harmonicGain = ctx.createGain();
    harmonic.type = 'triangle';
    harmonic.frequency.setValueAtTime(1760, now + 0.05);
    harmonicGain.gain.setValueAtTime(0.0001, now);
    harmonicGain.gain.exponentialRampToValueAtTime(0.08, now + 0.07);
    harmonicGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

    osc.connect(gain).connect(ctx.destination);
    harmonic.connect(harmonicGain).connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
    harmonic.start(now + 0.04);
    harmonic.stop(now + 0.35);

    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
      harmonic.disconnect();
      harmonicGain.disconnect();
    };
  } catch {
    // never let SFX break messaging
  }
}

/** Subtle soft pop for outgoing messages: filtered low-frequency bump. */
export function playOutgoingPop(): void {
  const ctx = getContext();
  if (!ctx) return;

  try {
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.06);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.16);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, now);
    filter.Q.value = 1.2;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.16, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);

    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  } catch {
    // never let SFX break messaging
  }
}
