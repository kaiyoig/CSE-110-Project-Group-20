import type { Screen } from "./ScreenController";
import type { StepAnswer } from "../questions/Question";
import type { Room } from "../map/Room";
import type { MapGrid } from "../map/MapGrid";
import type { MapFloor } from "../map/MapLayout";
import type { AccessDeniedPayload } from "../map/MapController";
import type { AddEntryResult, Difficulty, LoadResult } from "../score";
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
  setFloors(floors: readonly MapFloor[], solvedRoomIds: ReadonlySet<string>, activeFloorIndex?: number): void;
  /** Format with formatTime / formatMoney from score. */
  setHud(timeRemainingMs: number, timeLimitMs: number, money: number): void;
  showAccessDenied(payload: AccessDeniedPayload): void;
  onRoomClick(cb: (roomId: string) => void): Unsubscribe;
}

export interface RoomScreen extends Screen {
  /**
   * Builds a fresh puzzle of the Room's kind (`room.puzzle`), so the Room
   * restarts from Step 1; never changes the Room.
   */
  setRoom(room: Room): void;
  /** Format with formatTime / formatMoney from score. */
  setHud(timeRemainingMs: number, timeLimitMs: number, money: number): void;
  /** One call per Step's Answer, operation picks included. */
  onAnswer(cb: (answer: StepAnswer) => void): Unsubscribe;
  onExit(cb: () => void): Unsubscribe;
  /** Requests a hint from the game, which owns the score state. */
  onHint(cb: () => void): Unsubscribe;
  /** Displays the granted hint, or null when the room's limit is reached. */
  showHint(hintNumber: number | null): void;
}

export interface EndScreen extends Screen {
  /** A new result resets the screen, with the leaderboard shown as loading. */
  setResult(result: HeistResult): void;
  /** The current result's Difficulty's Leaderboard, or that it couldn't load. */
  setLeaderboard(board: LoadResult): void;
  /** Filled into the name box for each new result (the last name saved). */
  suggestName(name: string): void;
  /**
   * Only offered when result.outcome === "escaped". Save stays greyed out
   * until showSaveResult.
   */
  onSaveScore(cb: (playerName: string) => void): Unsubscribe;
  /**
   * How saving went: the Rank, or saved without one. After "saveFailed" the
   * name box comes back so the player can try again.
   */
  showSaveResult(result: AddEntryResult): void;
  /** A new Heist at the same Difficulty. */
  onPlayAgain(cb: () => void): Unsubscribe;
  onBackToStart(cb: () => void): Unsubscribe;
}

export interface CreditsScreen extends Screen {
  /** The player wants to return to the Start Screen. */
  onBack(cb: () => void): Unsubscribe;
}
