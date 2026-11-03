
# Answer Validation

## Overview

The Answer Validation component checks whether a player's answer to a Step is correct and records every Answer for later use.

It consists of two classes:
- `AnswerValidator` - Judges each Step's Answer, calls the Score Controller, and sends Correct/Incorrect events.
- `AnswerHistory` - Stores every judged Answer from one Heist, in order.

`Game` creates one of each and passes the history to the End Screen.

## AnswerValidator

The constructor takes:

- `history`: The `AnswerHistory` to record into.
- `score`: A `ScoreActions` (the `answerIncorrect` and `roomSolved` methods of `ScoreController`).
- `notifications`: The `NotificationManager` to send events through.

The `validateAnswer()` method accepts three parameters:

- `question`: The `Question` the Room is asking.
- `answer`: A `StepAnswer` from the puzzle:
  - `playerAnswer`: What the player submitted for this Step.
  - `correctAnswer`: The correct answer for this Step.
  - `isLastStep`: Whether this Step solves the Question.
- `kind`: The `RoomKind` (`"main"` or `"bonus"`) of the Room being solved.

It returns whether the Answer was correct. Leading and trailing whitespace is ignored.

| Answer                  | Score call               | Event       |
| ----------------------- | ------------------------ | ----------- |
| Incorrect (any Step)    | `answerIncorrect()`      | `Incorrect` |
| Correct, last Step      | `roomSolved(kind)`       | `Correct`   |
| Correct, earlier Step   | none                     | `Correct`   |

Every Answer, correct or not, is recorded in `AnswerHistory`.

### Example

```ts
const validator = new AnswerValidator(history, scoreController, notifications);

const question = { prompt: "x * 2 + 3 = 11", answer: "4" };

// An earlier Step: no score change
validator.validateAnswer(
    question,
    { playerAnswer: "-", correctAnswer: "-", isLastStep: false },
    "main",
);

// The last Step: the Room is Solved
validator.validateAnswer(
    question,
    { playerAnswer: "4", correctAnswer: "4", isLastStep: true },
    "main",
);
```

The puzzle decides each Step's `correctAnswer` and `isLastStep`. The validator only compares answers.

## AnswerHistory

Each `AnswerRecord` holds:

- `question`: The `Question` object
- `playerAnswer`: The player's submitted answer
- `correctAnswer`: The correct answer for that Step
- `isCorrect`: Whether the answer was correct
- `isLastStep`: Whether that Step solves the Question

### Methods

- `addResult(record)` - Adds an `AnswerRecord` to the history.
- `getResults()` - Returns a shallow copy of the stored records, so callers can't modify the history.

## Testing

Unit tests are written with Vitest.

To run the validation tests:

```bash
npx vitest run src/validation/
```

The tests cover correct and incorrect Answers, whitespace handling, main and bonus Rooms, earlier versus last Steps (operation picks included), and the records stored in the history.

The validator tests use a real `NotificationManager` and a mocked `ScoreActions`.
