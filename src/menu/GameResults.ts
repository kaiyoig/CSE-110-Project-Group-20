export type Difficulty = "easy" | "medium" | "hard";

// This subset accepts ScoreModel.snapshot() without importing an unmerged feature.
export interface GameResults {
  difficulty: Difficulty;
  money: number;
  roomsSolved: number;
  bonusRoomsSolved: number;
  incorrectAnswers: number;
  timeSpentMs: number;
  caught: boolean;
  flawless: boolean;
  score: number;
}

export interface ResultsSummary {
  heading: string;
  score: string;
  money: string;
  time: string;
  difficulty: string;
  rooms: string;
  bonusRooms: string;
  incorrectAnswers: string;
  showFlawless: boolean;
}

export function isDifficulty(value: unknown): value is Difficulty {
  return value === "easy" || value === "medium" || value === "hard";
}

export function isGameResults(value: unknown): value is GameResults {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const result = value as Partial<GameResults>;
  if (!isDifficulty(result.difficulty) || typeof result.caught !== "boolean" ||
      typeof result.flawless !== "boolean") {
    return false;
  }

  const amounts = [result.score, result.money, result.timeSpentMs];
  for (const amount of amounts) {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < 0) {
      return false;
    }
  }

  const counts = [result.roomsSolved, result.bonusRoomsSolved, result.incorrectAnswers];
  for (const count of counts) {
    if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) {
      return false;
    }
  }

  // roomsSolved already includes bonus rooms in Ping-Shu's snapshot.
  return typeof result.bonusRoomsSolved === "number" &&
    typeof result.roomsSolved === "number" && result.bonusRoomsSolved <= result.roomsSolved;
}

export function calculateTimeDisplay(timeSpentMs: number): string {
  if (!Number.isFinite(timeSpentMs) || timeSpentMs < 0) {
    throw new Error("Time must be a finite, non-negative number.");
  }

  // Match the score branch's formatTime helper by rounding up partial seconds.
  const totalSeconds = Math.ceil(timeSpentMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return String(hours).padStart(2, "0") + ":" +
    String(minutes).padStart(2, "0") + ":" + String(seconds).padStart(2, "0");
}

export function prepareResults(results: GameResults): ResultsSummary {
  if (!isGameResults(results)) {
    throw new Error("Results are incomplete or contain invalid values.");
  }

  let heading = "Heist complete!";
  if (results.caught) {
    heading = "You were caught!";
  }

  return {
    heading,
    score: results.score.toLocaleString("en-US"),
    money: results.money.toLocaleString("en-US", { style: "currency", currency: "USD" }),
    time: calculateTimeDisplay(results.timeSpentMs),
    difficulty: results.difficulty.charAt(0).toUpperCase() + results.difficulty.slice(1),
    rooms: String(results.roomsSolved),
    bonusRooms: String(results.bonusRoomsSolved),
    incorrectAnswers: String(results.incorrectAnswers),
    // A flawless escape badge needs a successful ending and a valid flawless flag.
    showFlawless: results.flawless && !results.caught &&
      results.incorrectAnswers === 0 && results.roomsSolved > 0,
  };
}
