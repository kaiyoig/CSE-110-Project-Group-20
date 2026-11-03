import { describe, it, expect, beforeEach } from "vitest";
import { Leaderboard, LEADERBOARD_KEY, type StorageLike } from "./Leaderboard";

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
    expect(board.getEntries("easy")).toEqual([]);
  });

  it("sorts by highest score, ties by fastest time", () => {
    board.addEntry({ difficulty: "easy", playerName: "A", score: 100, timeSpentMs: 5000 });
    board.addEntry({ difficulty: "easy", playerName: "B", score: 300, timeSpentMs: 9000 });
    board.addEntry({ difficulty: "easy", playerName: "C", score: 100, timeSpentMs: 2000 });
    expect(board.getEntries("easy").map((e) => e.playerName)).toEqual(["B", "C", "A"]);
  });

  it("returns the rank, or null if the score didn't make the board", () => {
    expect(board.addEntry({ difficulty: "easy", playerName: "A", score: 50, timeSpentMs: 1 })).toBe(1);
    expect(board.addEntry({ difficulty: "easy", playerName: "B", score: 80, timeSpentMs: 1 })).toBe(1);
    expect(board.addEntry({ difficulty: "easy", playerName: "C", score: 60, timeSpentMs: 1 })).toBe(2);
    expect(board.addEntry({ difficulty: "easy", playerName: "D", score: 10, timeSpentMs: 1 })).toBeNull();
    expect(board.getEntries("easy")).toHaveLength(3);
  });

  it("persists across Leaderboard instances", () => {
    board.addEntry({ difficulty: "easy", playerName: "A", score: 100, timeSpentMs: 1 });
    expect(new Leaderboard(storage).getEntries("easy")).toHaveLength(1);
  });

  it("uses 'Anonymous' for a blank name", () => {
    board.addEntry({ difficulty: "easy", playerName: "   ", score: 1, timeSpentMs: 1 });
    expect(board.getEntries("easy")[0].playerName).toBe("Anonymous");
  });

  it("rejects invalid entries", () => {
    expect(() => board.addEntry({ difficulty: "easy", playerName: "A", score: NaN, timeSpentMs: 1 })).toThrow(TypeError);
    expect(() => board.addEntry({ difficulty: "easy", playerName: "A", score: 1, timeSpentMs: -1 })).toThrow(TypeError);
  });

  it("recovers from corrupted storage", () => {
    storage.setItem(LEADERBOARD_KEY, "{not json");
    expect(board.getEntries("easy")).toEqual([]);
    storage.setItem(LEADERBOARD_KEY, JSON.stringify([{ junk: true }]));
    expect(board.getEntries("easy")).toEqual([]);
  });

  it("keeps a separate ranking for each difficulty", () => {
    board.addEntry({ difficulty: "easy", playerName: "E1", score: 900, timeSpentMs: 1 });
    board.addEntry({ difficulty: "hard", playerName: "H1", score: 100, timeSpentMs: 1 });
    expect(board.addEntry({ difficulty: "hard", playerName: "H2", score: 50, timeSpentMs: 1 })).toBe(2);
    expect(board.getEntries("easy").map((e) => e.playerName)).toEqual(["E1"]);
    expect(board.getEntries("hard").map((e) => e.playerName)).toEqual(["H1", "H2"]);
    expect(board.getEntries("medium")).toEqual([]);
  });

  it("limits each difficulty separately", () => {
    for (let i = 0; i < 5; i++) {
      board.addEntry({ difficulty: "easy", playerName: `E${i}`, score: i, timeSpentMs: 1 });
      board.addEntry({ difficulty: "hard", playerName: `H${i}`, score: i, timeSpentMs: 1 });
    }
    expect(board.getEntries("easy")).toHaveLength(3);
    expect(board.getEntries("hard")).toHaveLength(3);
  });

  it("clear() empties the board", () => {
    board.addEntry({ difficulty: "easy", playerName: "A", score: 1, timeSpentMs: 1 });
    board.clear();
    expect(board.getEntries("easy")).toEqual([]);
  });
});
