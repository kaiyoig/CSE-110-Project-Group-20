import { describe, expect, it, vi } from "vitest";
import { NotificationManager } from "../notification-manager/NotificationManager";
import { EventType } from "../notification-manager/GameEvent";
import { AudioManager, clampVolume } from "./AudioManager";

describe("AudioManager", () => {
  it("allows all gameplay events without Web Audio and supports mute", () => {
    const manager = new NotificationManager();
    const audio = new AudioManager(manager);
    expect(audio.isMuted()).toBe(false);
    audio.setMuted(true);
    expect(audio.isMuted()).toBe(true);
    for (const eventType of [EventType.Correct, EventType.Incorrect, EventType.GameOver] as const) {
      expect(() => manager.send({ eventType })).not.toThrow();
    }
    expect(() => manager.send({ eventType: EventType.RoomSolved, roomKind: "main", roomId: "room_a" })).not.toThrow();
    expect(() => manager.send({ eventType: EventType.HintUsed, roomId: "room_a" })).not.toThrow();
    audio.dispose();
  });

  it("clamps volume values", () => {
    expect(clampVolume(-1)).toBe(0);
    expect(clampVolume(2)).toBe(1);
    expect(clampVolume(0.4)).toBe(0.4);
    expect(clampVolume(NaN)).toBe(0);
  });

  it("starts one music loop on request and updates its volume and mute state", async () => {
    const player = {
      paused: true, loop: false, muted: false, volume: 1,
      play: vi.fn(async () => { player.paused = false; }),
      pause: vi.fn(() => { player.paused = true; }),
    };
    const createAudio = vi.fn(function () { return player; });
    vi.stubGlobal("Audio", createAudio);
    const audio = new AudioManager(new NotificationManager());
    try {
      expect(createAudio).not.toHaveBeenCalled();
      audio.startMusic();
      audio.startMusic();
      await Promise.resolve();
      expect(createAudio).toHaveBeenCalledTimes(1);
      expect(player.loop).toBe(true);
      expect(player.play).toHaveBeenCalledTimes(1);
      expect(player.volume).toBe(0.2);
      audio.setMusicVolume(0.7);
      audio.setSfxVolume(0.1);
      expect(player.volume).toBe(0.7);
      audio.setMuted(true);
      expect(player.muted).toBe(true);
      audio.setMuted(false);
      expect(player.muted).toBe(false);
      audio.dispose();
      expect(player.pause).toHaveBeenCalledOnce();
      audio.startMusic();
      expect(createAudio).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("does not open a new audio context after dispose", () => {
    const manager = new NotificationManager();
    const audio = new AudioManager(manager);
    const context = vi.fn();
    vi.stubGlobal("AudioContext", context);
    audio.dispose();
    manager.send({ eventType: EventType.Correct });
    expect(context).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});