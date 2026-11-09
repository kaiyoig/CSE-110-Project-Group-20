import type { Screen } from "./ScreenController";
import type { Question, StepAnswer } from "../questions/Question";
import type { MapGrid } from "../map/MapGrid";
import type { AccessDeniedPayload } from "../map/MapController";
import type { AddEntryResult, Difficulty, LeaderboardEntry } from "../score";
import type { HeistResult } from "../game/Game";

/**
 * Contracts the screen modules implement (see docs/plans/full-integration.md).
 *
 * Screens are passive views: data goes in through methods, player actions come
 * out through `onX(cb)` callbacks, and a screen holds no references to Game or
 * the controllers. Every `onX` returns an Unsubscribe function.
 */
export type Unsubscribe = () => void;

export interface StartScreen extends Screen {
  /** The player picked a Difficulty, which starts the Heist. */
  onStart(cb: (difficulty: Difficulty) => void): Unsubscribe;
}

export interface MapScreen extends Screen {
  /** Renders floor plan dynamically from the 2D MapGrid and solved room IDs */
  setGrid(grid: MapGrid, solvedRoomIds: ReadonlySet<string>): void;
  /** Format with formatTime / formatMoney from score. */
  setHud(timeRemainingMs: number, timeLimitMs: number, money: number): void;
  showAccessDenied(payload: AccessDeniedPayload): void;
  onRoomClick(cb: (roomId: string) => void): Unsubscribe;
}

export interface RoomScreen extends Screen {
  /** Builds a fresh puzzle, so the Room restarts from Step 1. */
  setQuestion(question: Question, roomName: string): void;
  /** Format with formatTime / formatMoney from score. */
  setHud(timeRemainingMs: number, timeLimitMs: number, money: number): void;
  /** One call per Step's Answer, operation picks included. */
  onAnswer(cb: (answer: StepAnswer) => void): Unsubscribe;
  onExit(cb: () => void): Unsubscribe;
}

export interface EndScreen extends Screen {
  setResult(result: HeistResult, leaderboard: LeaderboardEntry[]): void;
  /** Only offered when result.outcome === "escaped". */
  onSaveScore(cb: (playerName: string) => void): Unsubscribe;
  /** One line saying how saving went (rank, didn't make the board, or failed). */
  showSaveResult(result: AddEntryResult): void;
  /** A new Heist at the same Difficulty. */
  onPlayAgain(cb: () => void): Unsubscribe;
  onBackToStart(cb: () => void): Unsubscribe;
}
