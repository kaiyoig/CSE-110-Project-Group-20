import { describe, it, expect, vi } from "vitest";
import { AnswerHistory } from "./AnswerHistory";
import { AnswerValidator } from "./AnswerValidator";
import { EventType } from "../notification-manager/GameEvent";

describe("AnswerValidator", () => {
    //Test 1: checks if correct answer returns true
    it("Should Accept Correct Answer", () => {
        const history = new AnswerHistory();

        const score = {
            answerIncorrect: vi.fn(),
            roomSolved: vi.
            fn().mockReturnValue(100)
        }

        const notifications = {
            send: vi.fn()
        };

        const validator = new AnswerValidator(history, score, notifications);
        const question = {
        prompt: "5 + 3 = ?",
        answer: "8"
        };
        const result = validator.validateAnswer(
            question,
            "8",
            "8",
            true
        );

        expect(result).toBe(true);
        expect(score.roomSolved).toHaveBeenCalledOnce();
        expect(score.answerIncorrect).not.toHaveBeenCalled();

        expect(notifications.send).toHaveBeenCalledOnce();
        expect(notifications.send).toHaveBeenCalledWith({
        eventType: EventType.Correct
});
    });

    //Test 2: checks if incorrect answer returns false
    it("Should Reject Incorrect Answer", () => {
        const history = new AnswerHistory();
        const score = {
            answerIncorrect: vi.fn(),
            roomSolved: vi.fn().mockReturnValue(100)
        }

        const notifications = {
            send: vi.fn()
        };

        const validator = new AnswerValidator(history, score, notifications);
        const question = {
        prompt: "5 + 3 = ?",
        answer: "8"
        };
        const result = validator.validateAnswer(
            question,
            "6",
            "8",
            true
        );

        expect(result).toBe(false);
        expect(score.roomSolved).not.toHaveBeenCalled();
        expect(score.answerIncorrect).toHaveBeenCalledOnce();

        expect(notifications.send).toHaveBeenCalledOnce();
        expect(notifications.send).toHaveBeenCalledWith({
        eventType: EventType.Incorrect
    });
    });
        
    });

    //Test 3: checks that answers should ignore whitespace
    it("Should Ignore Extra Whitespace", () => {
        const history = new AnswerHistory();
        const score = {
            answerIncorrect: vi.fn(),
            roomSolved: vi.fn().mockReturnValue(100)
        }

        const notifications = {
            send: vi.fn()
        };

        const validator = new AnswerValidator(history, score, notifications);
        const question = {
        prompt: "5 + 3 = ?",
        answer: "8"
        };
        const result = validator.validateAnswer(
            question,
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

        const notifications = {
            send: vi.fn()
        };

        const validator = new AnswerValidator(history, score, notifications);
        const question = {
        prompt: "5 + 3 = ?",
        answer: "8"
        };
        validator.validateAnswer(question, "8", "8", true);

        expect(history.getResults()).toEqual([
            {
                question: question,
                expectedAnswer: "8",
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
        
        const notifications = {
            send: vi.fn()
        };

        const validator = new AnswerValidator(history, score, notifications);
        const question = {
        prompt: "5 + 3 = ?",
        answer: "8"
        };
        validator.validateAnswer(question, "6", "8", true);

        expect(history.getResults()).toEqual([
            {
                question: question,
                expectedAnswer: "8",
                playerAnswer: "6",
                isCorrect: false
            }
        ]);
    });

    //Test 6: Multiple Answers are added to history
    it("Should Track Multiple Answers", () => {
        const history = new AnswerHistory();
        const score = {
            answerIncorrect: vi.fn(),
            roomSolved: vi.fn().mockReturnValue(100)
        }
    
        const notifications = {
            send: vi.fn()
        };

        const validator = new AnswerValidator(history, score, notifications);
        const question = {
        prompt: "5 + 3 = ?",
        answer: "8"
        };
        const question2 = {
        prompt: "10 * 2 = ?",
        answer: "20"
        };
        const question3 = {
        prompt: "12 / 4 = ?",
        answer: "3"
        };
        validator.validateAnswer(question, "8", "8", true);
        validator.validateAnswer(question2, "15", "20", true);
        validator.validateAnswer(question3, "3", "3", true);

        const results = history.getResults();

        expect(results).toHaveLength(3);

        expect(results.map(result => result.question.prompt))
            .toEqual(["5 + 3 = ?", "10 * 2 = ?", "12 / 4 = ?"]);

        expect(results.map(result => result.isCorrect))
            .toEqual([true, false, true]);

        expect(results.map(result => result.playerAnswer))
            .toEqual(["8", "15", "3"]);

        expect(results.map(result => result.expectedAnswer))
            .toEqual(["8" , "20" , "3"]);

    });

    //TEST 7 rewards should not be granted for intermediate step
    it("Should Not Reward Correct Intermediate Step", () => {
    const history = new AnswerHistory();

    const score = {
        answerIncorrect: vi.fn(),
        roomSolved: vi.fn().mockReturnValue(100)
    };

    const notifications = {
        send: vi.fn()
    };

    const validator = new AnswerValidator(history, score, notifications);
    const question = {
    prompt: "3x + 2 = 17",
    answer: "5"
    };
    const result = validator.validateAnswer(
        question,
        "3x = 15",
        "3x = 15",
        false
    );

    expect(result).toBe(true);
    expect(score.roomSolved).not.toHaveBeenCalled();
    expect(score.answerIncorrect).not.toHaveBeenCalled();

    expect(notifications.send).toHaveBeenCalledOnce();
    expect(notifications.send).toHaveBeenCalledWith({
    eventType: EventType.Correct
    });
});
