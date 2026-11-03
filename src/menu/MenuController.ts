import { isDifficulty, isGameResults, type Difficulty, type GameResults } from "./GameResults";

export type MenuScreen = "start" | "playing" | "results";

export class MenuController {
  private screen: MenuScreen = "start";
  private selectedDifficulty: Difficulty = "easy";
  private results: GameResults | null = null;

  public onScreenChange: (() => void) | null = null;

  constructor(
    private readonly onStartGame: (difficulty: Difficulty) => void,
    private readonly onLeaveGame: () => void = () => {}
  ) {}

  public get currentScreen(): MenuScreen {
    return this.screen;
  }

  public get difficulty(): Difficulty {
    return this.selectedDifficulty;
  }

  public getResults(): GameResults | null {
    if (this.results === null) {
      return null;
    }
    return { ...this.results };
  }

  public startGame(difficulty: Difficulty): boolean {
    if (this.screen === "playing") {
      return false;
    }
    if (!isDifficulty(difficulty)) {
      throw new Error("Choose easy, medium, or hard.");
    }

    const previousScreen = this.screen;
    const previousDifficulty = this.selectedDifficulty;
    const previousResults = this.results;
    this.selectedDifficulty = difficulty;
    this.results = null;
    this.screen = "playing";

    try {
      this.onStartGame(difficulty);
    } catch (error) {
      // Keep the menu usable if the application's game setup fails.
      this.screen = previousScreen;
      this.selectedDifficulty = previousDifficulty;
      this.results = previousResults;
      throw error;
    }
    this.onScreenChange?.();
    return true;
  }

  public showResults(results: GameResults): boolean {
    if (this.screen !== "playing") {
      return false;
    }
    if (!isGameResults(results) || results.difficulty !== this.selectedDifficulty) {
      throw new Error("Results must be complete and match the current difficulty.");
    }

    this.onLeaveGame();
    this.results = { ...results };
    this.screen = "results";
    if (this.onScreenChange !== null) {
      this.onScreenChange();
    }
    return true;
  }

  public restartGame(): boolean {
    if (this.screen !== "results") {
      return false;
    }
    return this.startGame(this.selectedDifficulty);
  }

  public backToMenu(): void {
    if (this.screen === "start") {
      return;
    }
    if (this.screen === "playing") {
      this.onLeaveGame();
    }
    this.results = null;
    this.screen = "start";
    this.onScreenChange?.();
  }
}
