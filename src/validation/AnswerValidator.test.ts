import { describe, it, expect, vi, beforeEach } from "vitest";
import { AnswerHistory } from "./AnswerHistory";
import { AnswerValidator, type ScoreActions } from "./AnswerValidator";
import { NotificationManager } from "../notification-manager/NotificationManager";
import { EventType } from "../notification-manager/GameEvent";
import type { Question, StepAnswer } from "../questions/Question";

// Based on the AnswerValidator tests from #23 (brto222).

const question: Question = { prompt: "x * 2 + 3 = 11", answer: "4" };

function step(playerAnswer: string, correctAnswer: string, isLastStep: boolean): StepAnswer {
    return { playerAnswer, correctAnswer, isLastStep };
}

describe("AnswerValidator", () => {
    let history: AnswerHistory;
    let score: {
        answerIncorrect: ReturnType<typeof vi.fn<ScoreActions["answerIncorrect"]>>;
        roomSolved: ReturnType<typeof vi.fn<ScoreActions["roomSolved"]>>;
    };
    let notifications: NotificationManager;
    let events: EventType[];
    let validator: AnswerValidator;

    beforeEach(() => {
        history = new AnswerHistory();
        score = {
            answerIncorrect: vi.fn<ScoreActions["answerIncorrect"]>(),
            roomSolved: vi.fn<ScoreActions["roomSolved"]>().mockReturnValue(100),
        };
        notifications = new NotificationManager();
        events = [];
        for (const type of [EventType.Correct, EventType.Incorrect]) {
            notifications.subscribe(type, (e) => events.push(e.eventType));
        }
        validator = new AnswerValidator(history, score, notifications);
    });

    it("accepts a correct last Step and solves a main Room", () => {
        const result = validator.validateAnswer(question, step("4", "4", true), "main");

        expect(result).toBe(true);
        expect(score.roomSolved).toHaveBeenCalledExactlyOnceWith("main");
        expect(score.answerIncorrect).not.toHaveBeenCalled();
        expect(events).toEqual([EventType.Correct]);
    });

    it("solves a Bonus Room with its kind", () => {
        validator.validateAnswer(question, step("4", "4", true), "bonus");

        expect(score.roomSolved).toHaveBeenCalledExactlyOnceWith("bonus");
    });

    it("rejects an incorrect Answer with a time penalty", () => {
        const result = validator.validateAnswer(question, step("6", "4", true), "main");

        expect(result).toBe(false);
        expect(score.roomSolved).not.toHaveBeenCalled();
        expect(score.answerIncorrect).toHaveBeenCalledOnce();
        expect(events).toEqual([EventType.Incorrect]);
    });

    it("does not reward a correct earlier Step", () => {
        const result = validator.validateAnswer(question, step("-", "-", false), "main");

        expect(result).toBe(true);
        expect(score.roomSolved).not.toHaveBeenCalled();
        expect(score.answerIncorrect).not.toHaveBeenCalled();
        expect(events).toEqual([EventType.Correct]);
    });

    it("penalises a wrong earlier Step, operation picks included", () => {
        const result = validator.validateAnswer(question, step("+", "-", false), "main");

        expect(result).toBe(false);
        expect(score.answerIncorrect).toHaveBeenCalledOnce();
        expect(events).toEqual([EventType.Incorrect]);
    });

    it("ignores extra whitespace", () => {
        const result = validator.validateAnswer(question, step(" 4 ", "4", true), "main");

        expect(result).toBe(true);
        expect(score.roomSolved).toHaveBeenCalledOnce();
    });

    it("records every Answer as an AnswerRecord", () => {
        validator.validateAnswer(question, step("+", "-", false), "main");
        validator.validateAnswer(question, step("-", "-", false), "main");
        validator.validateAnswer(question, step("4", "4", true), "main");

        expect(history.getResults()).toEqual([
            { question, playerAnswer: "+", correctAnswer: "-", isCorrect: false, isLastStep: false },
            { question, playerAnswer: "-", correctAnswer: "-", isCorrect: true, isLastStep: false },
            { question, playerAnswer: "4", correctAnswer: "4", isCorrect: true, isLastStep: true },
        ]);
        expect(events).toEqual([EventType.Incorrect, EventType.Correct, EventType.Correct]);
    });
});
