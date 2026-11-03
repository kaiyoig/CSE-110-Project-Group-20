import { describe, it, expect, beforeEach, vi } from "vitest";
import { Leaderboard, LEADERBOARD_KEY, type StorageLike } from "./Leaderboard";
import { Difficulty } from "./ScoreModel";

class MemoryStorage implements StorageLike {
  private data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

describe("Leaderboard", () => {
  let storage: MemoryStorage;
  let board: Leaderboard;

  beforeEach(() => {
    storage = new MemoryStorage();
    board = new Leaderboard(storage, 3);
  });

  it("is empty at first", () => {
    expect(board.getEntries(Difficulty.Easy)).toEqual([]);
  });

  it("sorts by highest score, ties by fastest time", () => {
    board.addEntry({ difficulty: Difficulty.Easy, playerName: "A", score: 100, timeSpentMs: 5000 });
    board.addEntry({ difficulty: Difficulty.Easy, playerName: "B", score: 300, timeSpentMs: 9000 });
    board.addEntry({ difficulty: Difficulty.Easy, playerName: "C", score: 100, timeSpentMs: 2000 });
    expect(board.getEntries(Difficulty.Easy).map((e) => e.playerName)).toEqual(["B", "C", "A"]);
  });

  it("returns the rank, or null if the score didn't make the board", () => {
    expect(board.addEntry({ difficulty: Difficulty.Easy, playerName: "A", score: 50, timeSpentMs: 1 })).toBe(1);
    expect(board.addEntry({ difficulty: Difficulty.Easy, playerName: "B", score: 80, timeSpentMs: 1 })).toBe(1);
    expect(board.addEntry({ difficulty: Difficulty.Easy, playerName: "C", score: 60, timeSpentMs: 1 })).toBe(2);
    expect(board.addEntry({ difficulty: Difficulty.Easy, playerName: "D", score: 10, timeSpentMs: 1 })).toBeNull();
    expect(board.getEntries(Difficulty.Easy)).toHaveLength(3);
  });

  it("persists across Leaderboard instances", () => {
    board.addEntry({ difficulty: Difficulty.Easy, playerName: "A", score: 100, timeSpentMs: 1 });
    expect(new Leaderboard(storage).getEntries(Difficulty.Easy)).toHaveLength(1);
  });

  it("uses 'Anonymous' for a blank name", () => {
    board.addEntry({ difficulty: Difficulty.Easy, playerName: "   ", score: 1, timeSpentMs: 1 });
    expect(board.getEntries(Difficulty.Easy)[0].playerName).toBe("Anonymous");
  });

  it("rejects invalid entries", () => {
    expect(() => board.addEntry({ difficulty: Difficulty.Easy, playerName: "A", score: NaN, timeSpentMs: 1 })).toThrow(TypeError);
    expect(() => board.addEntry({ difficulty: Difficulty.Easy, playerName: "A", score: 1, timeSpentMs: -1 })).toThrow(TypeError);
  });

  it("recovers from corrupted storage", () => {
    storage.setItem(LEADERBOARD_KEY, "{not json");
    expect(board.getEntries(Difficulty.Easy)).toEqual([]);
    storage.setItem(LEADERBOARD_KEY, JSON.stringify([{ junk: true }]));
    expect(board.getEntries(Difficulty.Easy)).toEqual([]);
  });

  it("keeps a separate ranking for each difficulty", () => {
    board.addEntry({ difficulty: Difficulty.Easy, playerName: "E1", score: 900, timeSpentMs: 1 });
    board.addEntry({ difficulty: Difficulty.Hard, playerName: "H1", score: 100, timeSpentMs: 1 });
    expect(board.addEntry({ difficulty: Difficulty.Hard, playerName: "H2", score: 50, timeSpentMs: 1 })).toBe(2);
    expect(board.getEntries(Difficulty.Easy).map((e) => e.playerName)).toEqual(["E1"]);
    expect(board.getEntries(Difficulty.Hard).map((e) => e.playerName)).toEqual(["H1", "H2"]);
    expect(board.getEntries(Difficulty.Medium)).toEqual([]);
  });

  it("limits each difficulty separately", () => {
    for (let i = 0; i < 5; i++) {
      board.addEntry({ difficulty: Difficulty.Easy, playerName: `E${i}`, score: i, timeSpentMs: 1 });
      board.addEntry({ difficulty: Difficulty.Hard, playerName: `H${i}`, score: i, timeSpentMs: 1 });
    }
    expect(board.getEntries(Difficulty.Easy)).toHaveLength(3);
    expect(board.getEntries(Difficulty.Hard)).toHaveLength(3);
  });

  it("ignores old entries with an unknown difficulty", () => {
    storage.setItem(
      LEADERBOARD_KEY,
      JSON.stringify([{ playerName: "Old", difficulty: "easy", score: 1, timeSpentMs: 1, date: "" }]),
    );
    expect(board.getEntries(Difficulty.Easy)).toEqual([]);
  });

  it("returns an empty board if storage can't be read", () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error("storage disabled");
      },
      setItem: () => {},
      removeItem: () => {},
    };
    expect(new Leaderboard(broken).getEntries(Difficulty.Easy)).toEqual([]);
  });

  it("doesn't crash when storage is full; returns null instead", () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const full: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("quota exceeded", "QuotaExceededError");
      },
      removeItem: () => {},
    };
    const fullBoard = new Leaderboard(full);
    expect(fullBoard.addEntry({ difficulty: Difficulty.Easy, playerName: "A", score: 1, timeSpentMs: 1 })).toBeNull();
    expect(errorSpy).toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it("clear() empties the board", () => {
    board.addEntry({ difficulty: Difficulty.Easy, playerName: "A", score: 1, timeSpentMs: 1 });
    board.clear();
    expect(board.getEntries(Difficulty.Easy)).toEqual([]);
  });
});
