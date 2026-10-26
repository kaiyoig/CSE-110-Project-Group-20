# Score system (PingShu)

Everything lives in `src/score/`. Import from the folder:

```ts
import { ScoreModel, ScoreController, Leaderboard, formatTime, formatMoney } from "./score";
```

## Setup (once, when the game starts)

```ts
const score = new ScoreController(new ScoreModel({ difficulty: "medium" })); // "easy" | "medium" | "hard"
score.pauseWhenHidden();                         // pause when the tab is switched
score.onChange((m) => updateHud(m));             // HUD: time + money
score.onTimeUp(() => showEndScreen(score.getModel().snapshot())); // caught
```

## What each person needs to call

| Who | When | Call |
|---|---|---|
| **Calista** (map) | Player enters a room | `score.enterRoom()` |
| **Calista** (map) | Player goes back to the map | `score.returnToMap()` |
| **Calista** (map) | Vault solved, player escapes | `showEndScreen(score.getModel().snapshot())` |
| **Brian** (validation) | Answer is right | `score.roomSolved("main")` or `score.roomSolved("bonus")` |
| **Brian** (validation) | Answer is wrong | `score.answerIncorrect()` |
| **Seven** (HUD) | Show time / money | `formatTime(m.getTimeRemainingMs())`, `formatMoney(m.getMoney())` |
| **Asad** (end screen) | Show results | use the `snapshot()` object (below) |

## Things to watch out for

- **The clock only runs inside rooms.** Please call `enterRoom()` / `returnToMap()` every time — otherwise time won't move (or won't stop).
- **One room = one question.** Call `roomSolved()` once per room, not once per drag-and-drop piece.
- **Drag and drop:** the whole answer is right or wrong. If any slot is wrong when the player submits, that's one `answerIncorrect()`.
- **Don't change money or time directly.** Always go through `ScoreController` so the HUD gets updated.
- **Two endings:** `onTimeUp` only fires when the player is caught. A successful escape is triggered by the map (Vault). Both pass the same `snapshot()`.

## End screen data — `score.getModel().snapshot()`

```ts
{
  caught,            // true = time ran out (score is 0)
  score,             // final score
  money,             // money earned
  flawless,          // no wrong answers (show an achievement?)
  roomsSolved, bonusRoomsSolved, incorrectAnswers,
  timeSpentMs,       // show with formatTime()
  difficulty,        // "easy" | "medium" | "hard"
}
```

## Leaderboard — ⚠️ one ranking per difficulty

We originally planned one leaderboard. It is now **split by difficulty** (easy / medium / hard),
because hard questions take longer and a single ranking isn't fair.
The end/leaderboard screen should show three tabs (or a difficulty picker).

```ts
const board = new Leaderboard();                       // saved in localStorage
const rank = board.addEntry({ playerName, difficulty, score, timeSpentMs }); // returns rank, or null
board.getEntries("hard");                              // top 10, highest score first
```

Don't save a caught run (score 0) unless we decide otherwise.

## Rules (for reference)

- 1 hour per heist, only counts down inside rooms. Wrong answer: −60 s.
- Difficulty multiplier: easy ×1, medium ×3, hard ×6.
- Money: main room $100 × multiplier, bonus room $300 × multiplier. Money does **not** affect score (for skins later).
- Score = multiplier × correct answers × seconds left. Bonus rooms count as **3** correct answers.
- No wrong answers: score ×1.2. Time runs out: score = 0.

All numbers are constants at the top of `ScoreModel.ts` / `ScoreController.ts` — ask PingShu before changing them.

Run the tests: `npm test`
