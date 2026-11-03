
# Answer Validation

## Overview

The Answer Validation component checks whether a player's submitted answer is correct and stores the results for later use.

It consists of two classes:
- `AnswerValidator` - Checks answers, calls scoring methods, and sends notifications.
- `AnswerHistory` - Stores submitted answers and their validation results.

## AnswerValidator

The `validateAnswer()` method accepts four parameters:

- `question`: The Question object containing the problem and final answer.
- `playerAnswer`: The answer submitted by the player.
- `expectedAnswer`: The correct answer for the current step.
- `isFinalStep`: Whether the current step is the final step of the puzzle.

If the answer is incorrect, the Score Controller deducts time.

If the answer is correct and `isFinalStep` is true, the Score Controller rewards room completion.

The validator also sends correct or incorrect events to the Notification Manager and stores the result in AnswerHistory.

### Example

```ts
const question = {
    prompt: "5 + 3 = ?",
    answer: "8"
};

validator.validateAnswer(
    question,
    "8",
    "8",
    true
);
```

For multi-step puzzles, the puzzle component provides the expected answer for the current step and determines `isFinalStep`.

## AnswerHistory

AnswerHistory stores the following information for each submission:

- Question object
- Expected answer for the current step
- Player's submitted answer
- Whether the answer was correct

### Methods

- `addResult(result)` - Adds a new answer result to history.
- `getResults()` - Returns a shallow copy of the stored results.

The stored results can later be used for features such as reviewing incorrect answers at the end of the game.

## Testing

Unit tests were written using Vitest.

To run the validation tests:

```bash
npx vitest run src/validation/
```

The tests check correct and incorrect answers, whitespace handling, answer history, and scoring behavior for intermediate and final steps.

Score Controller and Notification Manager interactions are currently tested using mocked dependencies.

## Future Improvements

- Add integration tests with the real Score Controller and Notification Manager.
- Support different room types when rewarding room completion.
