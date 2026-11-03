import type { Screen } from "./ScreenController";
import type { Question } from "../questions/Question";
import type { Room } from "../map/Room";
import type { AccessDeniedPayload } from "../map/MapController";
import type { Difficulty, LeaderboardEntry } from "../score";
import type { HeistResult } from "../game/Game";

/**
 * Contracts the future screen modules implement (see docs/plans/full-integration.md).
 *
 * Screens are passive views: data goes in through methods, player actions come
 * out through `onX(cb)` callbacks. An `onX` may return an unsubscribe function
 * (preferred, like ScoreController); Game also ignores callbacks once its Heist
 * has ended, so a `void` return still works.
 */
export type Unsubscribe = () => void;

export interface StartScreen extends Screen {
  onStart(cb: (difficulty: Difficulty) => void): Unsubscribe | void;
}

export interface MapScreen extends Screen {
  /** Locked / Solved state is read from each Room. */
  setRooms(rooms: readonly Room[]): void;
  showAccessDenied(payload: AccessDeniedPayload): void;
  onRoomClick(cb: (roomId: string) => void): Unsubscribe | void;
}

export interface RoomScreen extends Screen {
  setQuestion(question: Question, roomName: string): void;
  /** Format with formatTime / formatMoney from score. */
  setHud(timeRemainingMs: number, money: number): void;
  /** Only the final Answer; Steps stay inside RoomScreen. */
  onAnswer(cb: (answer: string) => void): Unsubscribe | void;
  onExit(cb: () => void): Unsubscribe | void;
}

export interface EndScreen extends Screen {
  setResult(result: HeistResult, leaderboard: LeaderboardEntry[]): void;
  /** Only offered when result.outcome === "escaped". */
  onSaveScore(cb: (playerName: string) => void): Unsubscribe | void;
  onPlayAgain(cb: () => void): Unsubscribe | void;
}
