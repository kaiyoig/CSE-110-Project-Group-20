import { ScoreModel } from "./ScoreModel";
import type { RoomKind } from "../map/Room";
import { secondsToMs } from "./time";
import type { NotificationManager } from "../notification-manager/NotificationManager";
import { EventType } from "../notification-manager/GameEvent";

export type ScoreListener = (model: ScoreModel) => void;

/** Seconds taken off the clock for a wrong answer (can be overridden per call). */
export const WRONG_ANSWER_PENALTY_SECONDS = 60;

/**
 * ScoreController — drives the countdown and is the only thing that
 * changes money, time, or answer counts.
 *
 * Other systems don't call it directly. They send events through the
 * NotificationManager, and listenTo() turns those events into score changes:
 *   RoomEntered    → enterRoom()        clock runs
 *   ReturnedToMap  → returnToMap()      clock pauses (top-down map view)
 *   Incorrect      → answerIncorrect()  time penalty
 *   RoomSolved     → roomSolved(kind)   money + correct answer
 *
 * Usage:
 *   const score = new ScoreController(new ScoreModel({ difficulty: Difficulty.Medium }));
 *   score.listenTo(notifications);
 *   score.onChange((m) => hud.render(m));
 *   score.onTimeUp(() => showEndScreen());
 *   score.pauseWhenHidden();
 */
export class ScoreController {
  private readonly model: ScoreModel;
  private readonly tickMs: number;
  private readonly now: () => number;

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastTick = 0;
  private inRoom = false;
  private tabHidden = false;
  private changeListeners: ScoreListener[] = [];
  private timeUpListeners: ScoreListener[] = [];
  private eventUnsubscribers: (() => void)[] = [];

  constructor(model: ScoreModel, tickMs: number = 1000, now: () => number = () => Date.now()) {
    this.model = model;
    this.tickMs = tickMs;
    this.now = now;
  }

  getModel(): ScoreModel {
    return this.model;
  }

  /** True while the clock is actually counting down. */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  isInRoom(): boolean {
    return this.inRoom;
  }

  /** Player entered a puzzle room — the clock starts/resumes. */
  enterRoom(): void {
    this.inRoom = true;
    this.updateClock();
  }

  /** Player is back on the top-down map — the clock pauses. */
  returnToMap(): void {
    this.inRoom = false;
    this.updateClock();
  }

  /** The room's question was answered correctly. Returns the money earned. */
  roomSolved(kind: RoomKind = "main"): number {
    this.syncElapsed();
    const earned = this.model.recordRoomSolved(kind);
    this.emitChange();
    return earned;
  }

  answerIncorrect(penaltySeconds: number = WRONG_ANSWER_PENALTY_SECONDS): void {
    this.syncElapsed();
    this.model.recordIncorrect(secondsToMs(penaltySeconds));
    this.emitChange();
    this.checkTimeUp();
  }

  /** Generic time penalty not tied to a wrong answer (e.g. using a hint). */
  deductTime(seconds: number): void {
    this.syncElapsed();
    this.model.removeTime(secondsToMs(seconds));
    this.emitChange();
    this.checkTimeUp();
  }

  /**
   * Subscribes to the game events that change the score (see the table at the
   * top of this class). Returns a function that stops listening; dispose()
   * also stops listening.
   */
  listenTo(notifications: NotificationManager): () => void {
    const unsubscribers = [
      notifications.subscribe(EventType.RoomEntered, () => this.enterRoom()),
      notifications.subscribe(EventType.ReturnedToMap, () => this.returnToMap()),
      notifications.subscribe(EventType.Incorrect, () => this.answerIncorrect()),
      notifications.subscribe(EventType.RoomSolved, (event) => {
        if (event.eventType === EventType.RoomSolved) this.roomSolved(event.roomKind);
      }),
    ];
    this.eventUnsubscribers.push(...unsubscribers);
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      this.eventUnsubscribers = this.eventUnsubscribers.filter((u) => !unsubscribers.includes(u));
    };
  }

  onChange(listener: ScoreListener): () => void {
    this.changeListeners.push(listener);
    return () => {
      this.changeListeners = this.changeListeners.filter((l) => l !== listener);
    };
  }

  onTimeUp(listener: ScoreListener): () => void {
    this.timeUpListeners.push(listener);
    return () => {
      this.timeUpListeners = this.timeUpListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Pauses the clock while the browser tab is hidden. When the tab comes
   * back it only resumes if the player is still inside a room.
   * Returns a function that removes the listener.
   */
  pauseWhenHidden(doc: Document = document): () => void {
    const handler = () => {
      this.tabHidden = doc.hidden;
      this.updateClock();
    };
    doc.addEventListener("visibilitychange", handler);
    return () => doc.removeEventListener("visibilitychange", handler);
  }

  /** Stops the clock and all events for good (e.g. when the Heist ends). */
  dispose(): void {
    this.eventUnsubscribers.splice(0).forEach((unsubscribe) => unsubscribe());
    this.stopInterval();
    this.inRoom = false;
    this.changeListeners = [];
    this.timeUpListeners = [];
  }

  /** Starts or stops the interval so it matches the current state. */
  private updateClock(): void {
    const shouldRun = this.inRoom && !this.tabHidden && !this.model.isTimeUp();
    if (shouldRun && !this.isRunning()) {
      this.lastTick = this.now();
      this.intervalId = setInterval(() => this.tick(), this.tickMs);
    } else if (!shouldRun && this.isRunning()) {
      this.tick(); // count the partial second before stopping
      this.stopInterval();
    }
  }

  /** Applies time that passed since the last tick without notifying. */
  private syncElapsed(): void {
    if (!this.isRunning()) return;
    const current = this.now();
    const elapsed = current - this.lastTick;
    this.lastTick = current;
    if (elapsed > 0) this.model.removeTime(elapsed);
  }

  private tick(): void {
    this.syncElapsed();
    this.emitChange();
    this.checkTimeUp();
  }

  private checkTimeUp(): void {
    if (!this.model.isTimeUp()) return;
    this.stopInterval();
    const listeners = this.timeUpListeners;
    this.timeUpListeners = []; // fire only once
    listeners.forEach((l) => this.safeCall(l));
  }

  private stopInterval(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private emitChange(): void {
    this.changeListeners.forEach((l) => this.safeCall(l));
  }

  /** Runs a listener so that an error in it can't stop the timer or the game ending. */
  private safeCall(listener: ScoreListener): void {
    try {
      listener(this.model);
    } catch (err) {
      console.error("Score listener threw an error:", err);
    }
  }
}
