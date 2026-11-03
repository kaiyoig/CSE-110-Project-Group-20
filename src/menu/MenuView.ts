import { isDifficulty, prepareResults, type Difficulty } from "./GameResults";
import { MenuController } from "./MenuController";

export class MenuView {
  constructor(
    private readonly root: HTMLElement,
    private readonly controller: MenuController
  ) {}

  // The application renders gameplay in its own container.
  public render(): void {
    this.root.replaceChildren();
    this.root.hidden = this.controller.currentScreen === "playing";
    if (this.root.hidden) {
      return;
    }

    const panel = document.createElement("section");
    panel.className = "panel";
    const heading = document.createElement("h1");
    heading.tabIndex = -1;
    panel.append(heading);

    if (this.controller.currentScreen === "start") {
      heading.textContent = "Operation: Equation";
      const objective = document.createElement("p");
      objective.textContent = "Solve math puzzles, unlock the vault, and escape before time runs out.";
      const label = document.createElement("label");
      label.htmlFor = "difficulty";
      label.textContent = "Choose your difficulty";
      const select = document.createElement("select");
      select.id = "difficulty";
      const difficulties: Difficulty[] = ["easy", "medium", "hard"];
      for (const difficulty of difficulties) {
        const option = document.createElement("option");
        option.value = difficulty;
        option.textContent = difficulty.charAt(0).toUpperCase() + difficulty.slice(1);
        select.append(option);
      }
      select.value = this.controller.difficulty;
      panel.append(objective, label, select);
      this.addButton(panel, "Start Game", () => {
        if (isDifficulty(select.value)) {
          this.controller.startGame(select.value);
        }
      });
    } else {
      const results = this.controller.getResults();
      if (results === null) {
        return;
      }
      const summary = prepareResults(results);
      heading.textContent = summary.heading;
      const stats = document.createElement("dl");
      const rows = [
        ["Final score", summary.score],
        ["Money earned", summary.money],
        ["Time spent (including penalties)", summary.time],
        ["Difficulty", summary.difficulty],
        ["Rooms completed", summary.rooms],
        ["Bonus rooms (included above)", summary.bonusRooms],
        ["Incorrect answers", summary.incorrectAnswers],
      ];
      for (const [label, value] of rows) {
        const term = document.createElement("dt");
        const description = document.createElement("dd");
        term.textContent = label;
        description.textContent = value;
        stats.append(term, description);
      }
      panel.append(stats);
      if (summary.showFlawless) {
        const badge = document.createElement("p");
        badge.className = "badge";
        badge.textContent = "Flawless escape — no incorrect answers!";
        panel.append(badge);
      }
      this.addButton(panel, "Play Again", () => this.controller.restartGame());
      this.addButton(panel, "Back to Main Menu", () => this.controller.backToMenu());
    }

    this.root.append(panel);
    heading.focus();
  }

  private addButton(parent: HTMLElement, label: string, action: () => void): void {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => {
      try {
        action();
      } catch (error) {
        let message = parent.querySelector<HTMLElement>("[role='alert']");
        if (message === null) {
          message = document.createElement("p");
          message.setAttribute("role", "alert");
          parent.append(message);
        }
        message.textContent = "Unable to change screens. Please try again.";
        console.error(error);
      }
    });
    parent.append(button);
  }
}
