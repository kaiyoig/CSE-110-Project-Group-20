/**
 * ScoreModel — holds the player's score state for one heist.
 * Pure data + simple rules; no timers or DOM here (see ScoreController).
 *
 * Rules (decided by PingShu — tweak the constants below to rebalance):
 *  - A heist starts with 1 hour on the clock (it only runs inside rooms).
 *  - Each room is one question. Solving a room gives:
 *      main room:  1 correct answer,  $100 × difficulty multiplier
 *      bonus room: 3 correct answers, $300 × difficulty multiplier
 *  - Wrong answer: time penalty (see ScoreController) and no flawless bonus.
 *  - Final score = multiplier × weighted correct answers × seconds left,
 *    × 1.2 if the player never answered wrong.
 *  - Time runs out = caught = 0 points.
 *  - Money does NOT affect score (it's for buying skins later).
 */

export type Difficulty = "easy" | "medium" | "hard";
export type RoomKind = "main" | "bonus";

export const DEFAULT_TIME_LIMIT_MS = 60 * 60 * 1000; // 1 hour

export const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = {
  easy: 1,
  medium: 3,
  hard: 6,
};

/** How many "correct answers" a solved room counts as in the score formula. */
export const ROOM_SCORE_WEIGHT: Record<RoomKind, number> = {
  main: 1,
  bonus: 3,
};

/** Money for solving a room, before the difficulty multiplier. */
export const ROOM_MONEY: Record<RoomKind, number> = {
  main: 100,
  bonus: 300,
};

/** Score multiplier for finishing without a single wrong answer. */
export const FLAWLESS_BONUS = 1.2;

export interface ScoreOptions {
  difficulty?: Difficulty;
  /** Starting time on the clock. Defaults to 1 hour. */
  timeLimitMs?: number;
}

export interface ScoreSnapshot {
  difficulty: Difficulty;
  money: number;
  roomsSolved: number;
  bonusRoomsSolved: number;
  weightedCorrect: number;
  incorrectAnswers: number;
  timeLimitMs: number;
  timeRemainingMs: number;
  timeSpentMs: number;
  caught: boolean;
  flawless: boolean;
  score: number;
}

export class ScoreModel {
  private readonly difficulty: Difficulty;
  private readonly timeLimitMs: number;
  private money = 0;
  private mainRoomsSolved = 0;
  private bonusRoomsSolved = 0;
  private incorrectAnswers = 0;
  private timeRemainingMs: number;

  constructor(options: ScoreOptions = {}) {
    const { difficulty = "easy", timeLimitMs = DEFAULT_TIME_LIMIT_MS } = options;
    if (!(difficulty in DIFFICULTY_MULTIPLIER)) {
      throw new RangeError(`unknown difficulty: ${difficulty}`);
    }
    if (!Number.isFinite(timeLimitMs) || timeLimitMs <= 0) {
      throw new RangeError(`timeLimitMs must be a positive number, got ${timeLimitMs}`);
    }
    this.difficulty = difficulty;
    this.timeLimitMs = timeLimitMs;
    this.timeRemainingMs = timeLimitMs;
  }

  getDifficulty(): Difficulty {
    return this.difficulty;
  }

  getMultiplier(): number {
    return DIFFICULTY_MULTIPLIER[this.difficulty];
  }

  getMoney(): number {
    return this.money;
  }

  /** Rooms solved, main + bonus (each room is one question). */
  getRoomsSolved(): number {
    return this.mainRoomsSolved + this.bonusRoomsSolved;
  }

  getBonusRoomsSolved(): number {
    return this.bonusRoomsSolved;
  }

  /** Correct answers as counted by the score formula (bonus rooms count 3). */
  getWeightedCorrect(): number {
    return (
      this.mainRoomsSolved * ROOM_SCORE_WEIGHT.main +
      this.bonusRoomsSolved * ROOM_SCORE_WEIGHT.bonus
    );
  }

  getIncorrectAnswers(): number {
    return this.incorrectAnswers;
  }

  getTimeLimitMs(): number {
    return this.timeLimitMs;
  }

  getTimeRemainingMs(): number {
    return this.timeRemainingMs;
  }

  /** Time spent in rooms, including penalties. */
  getTimeSpentMs(): number {
    return this.timeLimitMs - this.timeRemainingMs;
  }

  isTimeUp(): boolean {
    return this.timeRemainingMs <= 0;
  }

  /** Time ran out = the player got caught. */
  isCaught(): boolean {
    return this.isTimeUp();
  }

  /** Never answered wrong (and solved at least one room). */
  isFlawless(): boolean {
    return this.incorrectAnswers === 0 && this.getRoomsSolved() > 0;
  }

  /** Player solved a room's question. Returns the money earned. */
  recordRoomSolved(kind: RoomKind): number {
    if (!(kind in ROOM_MONEY)) throw new RangeError(`unknown room kind: ${kind}`);
    if (kind === "bonus") this.bonusRoomsSolved += 1;
    else this.mainRoomsSolved += 1;
    const earned = ROOM_MONEY[kind] * this.getMultiplier();
    this.money += earned;
    return earned;
  }

  /** Player answered wrong: counts the mistake and removes penaltyMs from the clock. */
  recordIncorrect(penaltyMs: number): void {
    this.incorrectAnswers += 1;
    this.removeTime(penaltyMs);
  }

  /** Removes time from the clock (never goes below 0). */
  removeTime(ms: number): void {
    if (!Number.isFinite(ms) || ms < 0) {
      throw new RangeError(`ms must be a non-negative number, got ${ms}`);
    }
    this.timeRemainingMs = Math.max(0, this.timeRemainingMs - ms);
  }

  calculateScore(): number {
    if (this.isCaught()) return 0;
    const secondsLeft = Math.floor(this.timeRemainingMs / 1000);
    const base = this.getMultiplier() * this.getWeightedCorrect() * secondsLeft;
    return Math.round(this.isFlawless() ? base * FLAWLESS_BONUS : base);
  }

  snapshot(): ScoreSnapshot {
    return {
      difficulty: this.difficulty,
      money: this.money,
      roomsSolved: this.getRoomsSolved(),
      bonusRoomsSolved: this.bonusRoomsSolved,
      weightedCorrect: this.getWeightedCorrect(),
      incorrectAnswers: this.incorrectAnswers,
      timeLimitMs: this.timeLimitMs,
      timeRemainingMs: this.timeRemainingMs,
      timeSpentMs: this.getTimeSpentMs(),
      caught: this.isCaught(),
      flawless: this.isFlawless(),
      score: this.calculateScore(),
    };
  }
}
