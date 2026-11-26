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
        const result = validator.validateAnswer(question, step("4", "4", true), "main", "room_a");

        expect(result).toBe(true);
        expect(sent).toEqual([
            { eventType: EventType.RoomSolved, roomKind: "main", roomId: "room_a" },
            { eventType: EventType.Correct },
        ]);
    });

    it("solves a Bonus Room with its kind", () => {
        validator.validateAnswer(question, step("4", "4", true), "bonus", "room_x");

        expect(sent[0]).toEqual({ eventType: EventType.RoomSolved, roomKind: "bonus", roomId: "room_x" });
    });

    it("rejects an incorrect Answer with Incorrect only", () => {
        const result = validator.validateAnswer(question, step("6", "4", true), "main", "room_a");

        expect(result).toBe(false);
        expect(types()).toEqual([EventType.Incorrect]);
    });

    it("does not solve the Room on a correct earlier Step", () => {
        const result = validator.validateAnswer(question, step("-", "-", false), "main", "room_a");

        expect(result).toBe(true);
        expect(types()).toEqual([EventType.Correct]);
    });

    it("sends Incorrect for a wrong earlier Step, operation picks included", () => {
        const result = validator.validateAnswer(question, step("+", "-", false), "main", "room_a");

        expect(result).toBe(false);
        expect(types()).toEqual([EventType.Incorrect]);
    });

    it("solves the Room only on solvesRoom when a puzzle has several Questions", () => {
        // A Power Box wire: the only Step of its own Question, but not the last wire.
        validator.validateAnswer(question, { ...step("4", "4", true), solvesRoom: false }, "main", "room_a");
        expect(types()).toEqual([EventType.Correct]);

        validator.validateAnswer(question, { ...step("4", "4", true), solvesRoom: true }, "main", "room_a");
        expect(types()).toEqual([EventType.Correct, EventType.RoomSolved, EventType.Correct]);
    });

    it("never solves the Room on a wrong Answer, even with solvesRoom", () => {
        validator.validateAnswer(question, { ...step("5", "4", true), solvesRoom: true }, "main", "room_a");

        expect(types()).toEqual([EventType.Incorrect]);
    });

    it("ignores extra whitespace", () => {
        const result = validator.validateAnswer(question, step(" 4 ", "4", true), "main", "room_a");

        expect(result).toBe(true);
        expect(types()).toEqual([EventType.RoomSolved, EventType.Correct]);
    });

    it("accepts equivalent arithmetic expressions", () => {
        const result = validator.validateAnswer(
            question,
            step("2 * x", "x * 2", true),
            "main",
            "room_a",
        );

        expect(result).toBe(true);
        expect(types()).toEqual([EventType.RoomSolved, EventType.Correct]);
    });

    it.each(["10 + 2", "-4/2", "4/-2"])("rejects an unsimplified multistep answer: %s", playerAnswer => {
        const result = validator.validateAnswer(
            question,
            {
                ...step(playerAnswer, playerAnswer === "10 + 2" ? "12" : "-2", true),
                stepPrompt: playerAnswer,
                isMultistepArithmetic: true,
            },
            "main",
            "room_a",
        );

        expect(result).toBe(false);
        expect(types()).toEqual([EventType.Incorrect]);
    });

    it("does not apply multistep arithmetic validation to other puzzle answers", () => {
        const result = validator.validateAnswer(
            question,
            {
                ...step("10 + 2", "12", true),
                stepPrompt: "Wire the equation to its value of x",
            },
            "main",
            "room_a",
        );

        expect(result).toBe(true);
        expect(types()).toEqual([EventType.RoomSolved, EventType.Correct]);
    });

    it("records every Answer as an AnswerRecord", () => {
        validator.validateAnswer(question, step("+", "-", false), "main", "room_a");
        validator.validateAnswer(question, step("-", "-", false), "main", "room_a");
        validator.validateAnswer(question, step("4", "4", true), "main", "room_a");

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
