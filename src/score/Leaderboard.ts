import { isDifficultyType, type Difficulty } from "./ScoreModel";

/**
 * Leaderboard backed by localStorage (no login yet).
 * Each difficulty has its own ranking.
 * Storage is injectable so tests can use an in-memory fake.
 */
export interface LeaderboardEntry {
  playerName: string;
  difficulty: Difficulty;
  score: number;
  timeSpentMs: number;
  date: string; // ISO string
}

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const LEADERBOARD_KEY = "heist-leaderboard";

/** What happened when an entry was added. See Leaderboard.addEntry. */
export type AddEntryResult =
  | { status: "ranked"; rank: number }
  | { status: "notRanked" }
  | { status: "saveFailed" };

export class Leaderboard {
  private readonly storage: StorageLike;
  private readonly maxEntries: number;

  constructor(storage: StorageLike = localStorage, maxEntries: number = 10) {
    this.storage = storage;
    this.maxEntries = maxEntries;
  }

  /** One difficulty's entries, highest score first; ties go to the faster time. */
  getEntries(difficulty: Difficulty): LeaderboardEntry[] {
    return this.readAll().filter((e) => e.difficulty === difficulty);
  }

  /**
   * Reads every saved entry. Nothing saved yet (the first game) is normal and
   * gives an empty list. Anything else that goes wrong is logged so we can see
   * it in the console, but the game still shows an empty board instead of
   * crashing the End Screen.
   */
  private readAll(): LeaderboardEntry[] {
    let raw: string | null;
    try {
      raw = this.storage.getItem(LEADERBOARD_KEY);
    } catch (err) {
      console.error("Could not read the leaderboard from storage:", err);
      return [];
    }
    if (raw === null) return [];

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error("Saved leaderboard is not valid JSON, ignoring it:", err);
      return [];
    }
    if (!Array.isArray(parsed)) {
      console.error("Saved leaderboard is not a list, ignoring it:", parsed);
      return [];
    }
    return parsed.filter(isEntry).sort(compareEntries);
  }

  /**
   * Adds an entry to its difficulty's board. The result says which of three
   * things happened, so callers never have to guess what a missing rank means:
   *  - "ranked": saved, with its 1-based rank
   *  - "notRanked": not in the top entries, so nothing was written
   *  - "saveFailed": it made the board, but storage refused it (e.g. full)
   */
  addEntry(entry: Omit<LeaderboardEntry, "date"> & { date?: string }): AddEntryResult {
    const name = entry.playerName.trim() || "Anonymous";
    const full: LeaderboardEntry = {
      playerName: name,
      difficulty: entry.difficulty,
      score: entry.score,
      timeSpentMs: entry.timeSpentMs,
      date: entry.date ?? new Date().toISOString(),
    };
    if (!isEntry(full)) throw new TypeError("Invalid leaderboard entry");

    const all = this.readAll();
    const sameDifficulty = [...all.filter((e) => e.difficulty === full.difficulty), full]
      .sort(compareEntries)
      .slice(0, this.maxEntries);
    const index = sameDifficulty.indexOf(full);
    if (index === -1) return { status: "notRanked" };

    const others = all.filter((e) => e.difficulty !== full.difficulty);
    try {
      this.storage.setItem(LEADERBOARD_KEY, JSON.stringify([...others, ...sameDifficulty]));
    } catch (err) {
      console.error("Could not save the leaderboard:", err);
      return { status: "saveFailed" };
    }
    return { status: "ranked", rank: index + 1 };
  }

  clear(): void {
    try {
      this.storage.removeItem(LEADERBOARD_KEY);
    } catch (err) {
      console.error("Could not clear the leaderboard:", err);
    }
  }
}

function compareEntries(a: LeaderboardEntry, b: LeaderboardEntry): number {
  return b.score - a.score || a.timeSpentMs - b.timeSpentMs;
}

function isEntry(value: unknown): value is LeaderboardEntry {
  const e = value as LeaderboardEntry;
  return (
    typeof e === "object" &&
    e !== null &&
    typeof e.playerName === "string" &&
    isDifficultyType(e.difficulty) &&
    Number.isFinite(e.score) &&
    Number.isFinite(e.timeSpentMs) &&
    e.timeSpentMs >= 0 &&
    typeof e.date === "string"
  );
}
