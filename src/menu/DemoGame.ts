import { type Difficulty, type GameResults } from "./GameResults";
import { MenuController } from "./MenuController";

// Display fixtures only: these values are not calculated from the practice question.
function sampleResults(difficulty: Difficulty, caught: boolean): GameResults {
  const results: GameResults = {
    difficulty,
    score: 16968,
    money: 400,
    roomsSolved: 2,
    bonusRoomsSolved: 1,
    incorrectAnswers: 0,
    timeSpentMs: 65000,
    caught: false,
    flawless: true,
  };
  if (caught) {
    results.caught = true;
    results.score = 0;
    results.timeSpentMs = 3600000;
  }
  return results;
}

export function showDemo(root: HTMLElement, controller: MenuController, difficulty: Difficulty): void {
  root.replaceChildren();
  const panel = document.createElement("section");
  panel.className = "panel";
  // Only fixed demo markup goes into innerHTML. Result data uses textContent in MenuView.
  panel.innerHTML = `
    <h1 tabindex="-1">Practice vault</h1>
    <p>This is a menu demonstration, not the team's full game.</p>
    <p id="demo-difficulty"></p>
    <form>
      <label for="practice-answer">Solve 7 + 5 to unlock the sample success screen.</label>
      <input id="practice-answer" type="number" step="1" required autocomplete="off">
      <button type="submit">Check answer</button>
    </form>
    <p role="status" aria-live="polite"></p>
    <button type="button" id="demo-escape" disabled>Preview successful heist</button>
    <button type="button" id="demo-caught">Preview caught heist</button>
    <button type="button" id="demo-back">Back to Main Menu</button>
    <p class="note">Both endings use fixed sample values, independent of your practice
    answers and difficulty. No score is calculated or saved.</p>
  `;
  root.append(panel);

  const difficultyLabel = panel.querySelector<HTMLElement>("#demo-difficulty")!;
  difficultyLabel.textContent = "Selected difficulty: " + difficulty;
  const form = panel.querySelector<HTMLFormElement>("form")!;
  const input = panel.querySelector<HTMLInputElement>("input")!;
  const feedback = panel.querySelector<HTMLElement>("[role='status']")!;
  const escape = panel.querySelector<HTMLButtonElement>("#demo-escape")!;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (input.value.trim() === "") {
      feedback.textContent = "Enter an answer first.";
    } else if (Number(input.value) === 12) {
      feedback.textContent = "Correct! You can now preview a successful heist.";
      escape.disabled = false;
    } else {
      feedback.textContent = "Not quite. Try adding 5 to 7 again.";
    }
  });

  escape.addEventListener("click", () => controller.showResults(sampleResults(difficulty, false)));
  panel.querySelector("#demo-caught")!.addEventListener("click", () => {
    controller.showResults(sampleResults(difficulty, true));
  });
  panel.querySelector("#demo-back")!.addEventListener("click", () => controller.backToMenu());
}
