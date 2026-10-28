import { describe, it, expect, vi } from "vitest";
import { AnswerHistory } from "./AnswerHistory";
import { AnswerValidator } from "./AnswerValidator";

//Test 1: checks if correct answer returns true
describe("AnswerValidator", () => {
    it("Should Accept Correct Answer", () => {
        const history = new AnswerHistory();

        const score = {
            answerIncorrect: vi.fn(),
            roomSolved: vi.fn().mockReturnValue(100)
        }

        const validator = new AnswerValidator(history, score);

        const result = validator.validateAnswer(
            "5 + 3 = ?",
            "8",
            "8",
            true
        );

        expect(result).toBe(true);
        expect(score.roomSolved).toHaveBeenCalledOnce();
        expect(score.answerIncorrect).not.toHaveBeenCalled();
    });

    //Test 2: checks if incorrect answer returns false
    it("Should Reject Incorrect Answer", () => {
        const history = new AnswerHistory();
        const score = {
            answerIncorrect: vi.fn(),
            roomSolved: vi.fn().mockReturnValue(100)
        }

        const validator = new AnswerValidator(history, score);

        const result = validator.validateAnswer(
            "5 + 3 = ?",
            "6",
            "8",
            true
        );

        expect(result).toBe(false);
        expect(score.roomSolved).not.toHaveBeenCalled();
        expect(score.answerIncorrect).toHaveBeenCalledOnce();
    });

    //Test 3: checks that answers should ignore whitespace
    it("Should Ignore Extra Whitespace", () => {
        const history = new AnswerHistory();
        const score = {
            answerIncorrect: vi.fn(),
            roomSolved: vi.fn().mockReturnValue(100)
        }

        const validator = new AnswerValidator(history, score);
        const result = validator.validateAnswer(
            "5 + 3 = ?",
            " 8 ",
            "8",
            true
        );

        expect(result).toBe(true);
        expect(score.roomSolved).toHaveBeenCalledOnce();
        expect(score.answerIncorrect).not.toHaveBeenCalled();
    });

    //Test 4: Correct Answers are added to history
    it("Should Record Correct Answer", () => {
        const history = new AnswerHistory();
        const score = {
            answerIncorrect: vi.fn(),
            roomSolved: vi.fn().mockReturnValue(100)
        }

        const validator = new AnswerValidator(history, score);
        validator.validateAnswer("5 + 3 = ?", "8", "8", true);

        expect(history.getResults()).toEqual([
            {
                question: "5 + 3 = ?",
                correctAnswer: "8",
                playerAnswer: "8",
                isCorrect: true
            }
        ]);


    });

    //Test 5: Incorrect Answers are added to history
    it("Should Record Incorrect Answer", () => {
        const history = new AnswerHistory();
        const score = {
            answerIncorrect: vi.fn(),
            roomSolved: vi.fn().mockReturnValue(100)
        }

        const validator = new AnswerValidator(history, score);
        validator.validateAnswer("5 + 3 = ?", "6", "8", true);

        expect(history.getResults()).toEqual([
            {
                question: "5 + 3 = ?",
                correctAnswer: "8",
                playerAnswer: "6",
                isCorrect: false
            }
        ]);
    });

    //Test 5: Multiple Answers are added to history
    it("Should Track Multiple Answers", () => {
        const history = new AnswerHistory();
        const score = {
            answerIncorrect: vi.fn(),
            roomSolved: vi.fn().mockReturnValue(100)
        }

        const validator = new AnswerValidator(history, score);
        validator.validateAnswer("5 + 3 = ?", "8", "8", true);
        validator.validateAnswer("10 * 2 = ?", "15", "20", true);
        validator.validateAnswer("12 / 4 = ?", "3", "3", true);

        const results = history.getResults();

        expect(results).toHaveLength(3);

        expect(results.map(result => result.question))
            .toEqual(["5 + 3 = ?", "10 * 2 = ?", "12 / 4 = ?"]);

        expect(results.map(result => result.isCorrect))
            .toEqual([true, false, true]);

        expect(results.map(result => result.playerAnswer))
            .toEqual(["8", "15", "3"]);

        expect(results.map(result => result.correctAnswer))
            .toEqual(["8" , "20" , "3"]);

    });

    //TEST 7 rewards should not be granted for intermediate step
    it("Should Not Reward Correct Intermediate Step", () => {
    const history = new AnswerHistory();

    const score = {
        answerIncorrect: vi.fn(),
        roomSolved: vi.fn().mockReturnValue(100)
    };

    const validator = new AnswerValidator(history, score);

    const result = validator.validateAnswer(
        "3x + 2 = 17",
        "3x = 15",
        "3x = 15",
        false
    );

    expect(result).toBe(true);
    expect(score.roomSolved).not.toHaveBeenCalled();
    expect(score.answerIncorrect).not.toHaveBeenCalled();
});




});