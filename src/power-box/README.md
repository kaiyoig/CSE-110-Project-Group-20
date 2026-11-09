# Power Box minigame (PingShu)

A kind of Room puzzle, styled after the wiring task in Among Us. The left
side has equations from the **QuestionGenerator** (`getQuestion`), the right
side has their answers (the value of x) in a shuffled order. The player
connects each equation to its answer. Every correct wire
turns on one security light; when all wires are connected, security goes
**OFFLINE** and the Room is Solved.

## Using it in a Room

`PowerBoxPuzzle` has the same shape as `BasicMultistepPuzzle`, so the Room
Screen can build either one:

```ts
import PowerBoxPuzzle from "../puzzles/power-box-puzzle";

const puzzle = new PowerBoxPuzzle(difficulty, {
  layer,                 // a Konva layer
  x: 720, y: 480,        // center of the panel
  width: 960, height: 520,
  backdrop: { width: DESIGN_WIDTH, height: DESIGN_HEIGHT }, // optional server-room scene
});
puzzle.onAnswer = (answer, question) => {
  /* send to AnswerValidator. Use `question`, not the Room's Question:
     a power box has one Question per wire. */
};
puzzle.onPuzzleFinished = () => { /* every wire connected */ };
// when leaving the Room:
puzzle.destroy();
```

Each wire the player tries is one **Step** (`StepAnswer`):

| Player does | StepAnswer | Through AnswerValidator |
|---|---|---|
| Connects a wrong answer | `playerAnswer` ≠ `correctAnswer` | `Incorrect` → −60 s |
| Connects a right answer (not the last) | equal, `isLastStep: false` | `Correct` |
| Connects the last wire | equal, `isLastStep: true` | `RoomSolved` → money, then `Correct` |

The player can **click** a left jack and then a right jack, or **drag** a
cable from left to right:

- While dragging, a dashed cable with a **plug** on the end follows the pointer.
- Near a free right jack (`SNAP_RADIUS`, 60 px) the cable **snaps** to it and
  the jack lights up; letting go (or clicking) there plugs it in.
- Letting go on empty space, or clicking empty space, **cancels**: the cable
  pulls back into its jack. A cancel is not a Step and costs no time.
- A correct cable plugs in with a burst of **sparks**.

## Look

Industrial style: a brushed-steel panel with a hazard-stripe title band,
equations and answers on green LCD screens, sagging coloured cables, and a
status display with one LED per cable (`ONLINE: n LEFT` → `OFFLINE`). A wrong
answer flashes its screen red. With `backdrop`, the box hangs in a server
room (concrete wall, pipes, server racks with LEDs, a HIGH VOLTAGE sign);
the scene goes just above the screen's plain background and below its
title, HUD and Exit button.

## Difficulty

| Difficulty | Wires (equations) |
|---|---|
| Easy | 3 |
| Medium | 4 |
| Hard | 5 |

The equations come from `getQuestion(difficulty)`, so when the
QuestionGenerator gets harder per difficulty, the power box does too. No two wires share an answer, so each
equation has exactly one match. The wire counts are `PAIR_COUNT` in
`power-box-generator.ts`.
On screen, `*` is shown as `·` (`formatMath` in
`src/questions/formatMath.ts`); `/` and `-` are shown as they are. The
multistep puzzle still shows `*`; it can switch to the same `formatMath`
when its UI is updated, so both Rooms match.

## Making it a Room type (for whoever wires up Rooms)

Right now `RoomScreen.setQuestion` always builds a `BasicMultistepPuzzle`.
To add the power box as a second kind of Room:

1. Give each Room a puzzle kind, e.g. `puzzle: "multistep" | "powerBox"` in
   `RoomConfig` / `ROOM_LAYOUT`.
2. In the Room Screen, build `new PowerBoxPuzzle(difficulty, { layer, x, y, width, height })`
   for a power box Room (the same panel spot as the multistep puzzle works),
   and call `destroy()` when leaving, like the multistep puzzle.
3. Forward `onAnswer(answer, question)` the same way, but pass that
   `question` to `validateAnswer` instead of the Room's Question.
4. The Room is Solved by the Step with `isLastStep: true`, exactly like the
   multistep puzzle, so Game's ending logic doesn't change.

## Files

| File | Job |
|---|---|
| `power-box-generator.ts` | Gets the Questions from the QuestionGenerator and shuffles the answers |
| `power-box-model.ts` | Which wires are connected; turns each try into a `StepAnswer` |
| `power-box-view.ts` | Draws the panel, jacks, cables and status LEDs (Konva) |
| `power-box-backdrop.ts` | The server-room scene behind the box (decoration only) |
| `power-box-controller.ts` | Connects view presses to the model |
| `../puzzles/power-box-puzzle.ts` | Puts the four together, ready for a Room |

`PowerBoxPuzzle` takes optional `makeQuestion` (defaults to `getQuestion`)
and `random` (defaults to `Math.random`), so tests can make the same box
every time.

## Tests

`npm test` runs `src/power-box/*.test.ts`: the generator (asks the
QuestionGenerator at the right difficulty, no duplicate answers), the model (right/wrong matches, last
Step), the controller (with a fake view), and the view (with the fake Konva in
`src/screens/testing`).
