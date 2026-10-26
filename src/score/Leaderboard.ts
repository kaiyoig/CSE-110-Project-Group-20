import type { Difficulty } from "./ScoreModel";

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

  private readAll(): LeaderboardEntry[] {
    const raw = this.storage.getItem(LEADERBOARD_KEY);
    if (!raw) return [];
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(isEntry).sort(compareEntries);
    } catch {
      return []; // corrupted data — start fresh rather than crash
    }
  }

  /** Adds an entry and returns its rank within its difficulty (1-based), or null if it didn't make the board. */
  addEntry(entry: Omit<LeaderboardEntry, "date"> & { date?: string }): number | null {
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
    const others = all.filter((e) => e.difficulty !== full.difficulty);
    this.storage.setItem(LEADERBOARD_KEY, JSON.stringify([...others, ...sameDifficulty]));
    const index = sameDifficulty.indexOf(full);
    return index === -1 ? null : index + 1;
  }

  clear(): void {
    this.storage.removeItem(LEADERBOARD_KEY);
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
    (e.difficulty === "easy" || e.difficulty === "medium" || e.difficulty === "hard") &&
    Number.isFinite(e.score) &&
    Number.isFinite(e.timeSpentMs) &&
    e.timeSpentMs >= 0 &&
    typeof e.date === "string"
  );
}
