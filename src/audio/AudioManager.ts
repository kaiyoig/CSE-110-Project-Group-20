import type { NotificationManager } from "../notification-manager/NotificationManager";
import { EventType } from "../notification-manager/GameEvent";

export const DEFAULT_MUSIC_VOLUME = 0.2;
export const DEFAULT_SFX_VOLUME = 0.65;

export function clampVolume(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

/**
 * App-scoped audio: event-driven sound effects and an optional local music loop.
 * Music starts only after a user gesture; audio failures never interrupt play.
 */
export class AudioManager {
  private context: AudioContext | null = null;
  private readonly unsubscribers: Array<() => void> = [];
  private muted = false;
  private musicVolume = DEFAULT_MUSIC_VOLUME;
  private sfxVolume = DEFAULT_SFX_VOLUME;
  private sfxGain: GainNode | null = null;
  private music: HTMLAudioElement | null = null;
  private musicStarting = false;
  private disposed = false;

  constructor(notifications: NotificationManager) {
    this.unsubscribers.push(
      notifications.subscribe(EventType.Correct, () => this.tone(740, 0.12)),
      notifications.subscribe(EventType.Incorrect, () => this.tone(210, 0.24, "sawtooth")),
      notifications.subscribe(EventType.RoomSolved, () => this.tone(980, 0.22)),
      notifications.subscribe(EventType.HintUsed, () => this.tone(540, 0.10, "triangle")),
      notifications.subscribe(EventType.GameOver, () => this.tone(520, 0.38, "triangle")),
    );
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.updateLevels();
  }

  isMuted(): boolean {
    return this.muted;
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = clampVolume(volume);
    this.updateLevels();
  }

  setSfxVolume(volume: number): void {
    this.sfxVolume = clampVolume(volume);
    this.updateLevels();
  }

  private updateLevels(): void {
    if (this.music) {
      this.music.volume = this.musicVolume;
      this.music.muted = this.muted;
    }
    if (this.sfxGain) this.sfxGain.gain.value = this.muted ? 0 : this.sfxVolume;
  }

  /** Call from a real user gesture to satisfy browser autoplay policies. */
  startMusic(): void {
    if (this.disposed || typeof Audio === "undefined" || this.musicStarting) return;
    try {
      if (!this.music) {
        this.music = new Audio(import.meta.env.BASE_URL + "audio/spy-loop.mp3");
        this.music.loop = true;
        this.updateLevels();
      }
      if (!this.music.paused) return;
      this.musicStarting = true;
      void this.music.play().catch(() => {
        // Missing file or browser policy: leave the game playable and allow retry.
      }).finally(() => { this.musicStarting = false; });
    } catch {
      this.musicStarting = false;
    }
  }

  dispose(): void {
    this.disposed = true;
    this.music?.pause();
    this.music = null;
    this.sfxGain = null;
    this.unsubscribers.splice(0).forEach((stop) => stop());
    const context = this.context;
    this.context = null;
    if (context) void context.close().catch(() => {});
  }

  private tone(frequency: number, duration: number, waveform: OscillatorType = "sine"): void {
    if (this.disposed || this.muted || this.sfxVolume === 0 || typeof AudioContext === "undefined") return;
    try {
      const ctx = this.context ?? new AudioContext();
      this.context = ctx;
      if (!this.sfxGain) {
        this.sfxGain = ctx.createGain();
        this.sfxGain.connect(ctx.destination);
        this.updateLevels();
      }
      // Browsers often suspend audio until the player interacts with the page.
      if (ctx.state === "suspended") void ctx.resume().catch(() => {});
      const oscillator = ctx.createOscillator();
      const volume = ctx.createGain();
      const start = ctx.currentTime;
      oscillator.type = waveform;
      oscillator.frequency.setValueAtTime(frequency, start);
      volume.gain.setValueAtTime(0.0001, start);
      volume.gain.exponentialRampToValueAtTime(0.08, start + 0.018);
      volume.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(volume);
      volume.connect(this.sfxGain);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.02);
    } catch {
      // Unsupported or restricted audio must never interrupt gameplay.
    }
  }
}
