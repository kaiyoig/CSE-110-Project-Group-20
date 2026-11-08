import { describe, it, expect, beforeEach } from "vitest";
import { AnswerHistory } from "./AnswerHistory";
import { AnswerValidator } from "./AnswerValidator";
import { NotificationManager } from "../notification-manager/NotificationManager";
import { EventType, type GameEvent } from "../notification-manager/GameEvent";
import type { Question, StepAnswer } from "../questions/Question";

// Based on the AnswerValidator tests from #23 (brto222).

const question: Question = { prompt: "x * 2 + 3 = 11", answer: "4" };

function step(playerAnswer: string, correctAnswer: string, isLastStep: boolean): StepAnswer {
    return { playerAnswer, correctAnswer, isLastStep };
}

describe("AnswerValidator", () => {
    let history: AnswerHistory;
    let notifications: NotificationManager;
    let sent: GameEvent[];
    let validator: AnswerValidator;

    /** The event types sent so far, in order. */
    const types = () => sent.map((e) => e.eventType);

    beforeEach(() => {
        history = new AnswerHistory();
        notifications = new NotificationManager();
        sent = [];
        for (const type of [EventType.Correct, EventType.Incorrect, EventType.RoomSolved]) {
            notifications.subscribe(type, (e) => sent.push(e));
        }
        validator = new AnswerValidator(history, notifications);
    });

    it("accepts a correct last Step: RoomSolved for a main Room, then Correct", () => {
        const result = validator.validateAnswer(question, step("4", "4", true), "main");

        expect(result).toBe(true);
        expect(sent).toEqual([
            { eventType: EventType.RoomSolved, roomKind: "main" },
            { eventType: EventType.Correct },
        ]);
    });

    it("solves a Bonus Room with its kind", () => {
        validator.validateAnswer(question, step("4", "4", true), "bonus");

        expect(sent[0]).toEqual({ eventType: EventType.RoomSolved, roomKind: "bonus" });
    });

    it("rejects an incorrect Answer with Incorrect only", () => {
        const result = validator.validateAnswer(question, step("6", "4", true), "main");

        expect(result).toBe(false);
        expect(types()).toEqual([EventType.Incorrect]);
    });

    it("does not solve the Room on a correct earlier Step", () => {
        const result = validator.validateAnswer(question, step("-", "-", false), "main");

        expect(result).toBe(true);
        expect(types()).toEqual([EventType.Correct]);
    });

    it("sends Incorrect for a wrong earlier Step, operation picks included", () => {
        const result = validator.validateAnswer(question, step("+", "-", false), "main");

        expect(result).toBe(false);
        expect(types()).toEqual([EventType.Incorrect]);
    });

    it("ignores extra whitespace", () => {
        const result = validator.validateAnswer(question, step(" 4 ", "4", true), "main");

        expect(result).toBe(true);
        expect(types()).toEqual([EventType.RoomSolved, EventType.Correct]);
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
        expect(types()).toEqual([
            EventType.Incorrect,
            EventType.Correct,
            EventType.RoomSolved,
            EventType.Correct,
        ]);
    });
});
