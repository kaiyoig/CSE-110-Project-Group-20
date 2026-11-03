import { describe, it, expect } from "vitest";
import { AnswerHistory, type AnswerRecord } from "./AnswerHistory";

const question = { prompt: "x * 2 + 3 = 11", answer: "4" };

function record(overrides: Partial<AnswerRecord> = {}): AnswerRecord {
    return {
        question,
        playerAnswer: "4",
        correctAnswer: "4",
        isCorrect: true,
        isLastStep: true,
        ...overrides,
    };
}

describe("AnswerHistory", () => {
    it("Should Start With An Empty History", () => {
        const history = new AnswerHistory();

        expect(history.getResults()).toEqual([]);
    });

    it("Should Store An Answer Record", () => {
        const history = new AnswerHistory();
        const result = record();

        history.addResult(result);

        expect(history.getResults()).toEqual([result]);
    });

    it("Should Keep Records In Order", () => {
        const history = new AnswerHistory();
        const first = record({ playerAnswer: "-", correctAnswer: "-", isLastStep: false });
        const second = record();

        history.addResult(first);
        history.addResult(second);

        expect(history.getResults()).toEqual([first, second]);
    });

    it("Should Protect Original History", () => {
        const history = new AnswerHistory();
        const result = record();
        history.addResult(result);

        const copiedResults = history.getResults();
        copiedResults.pop();

        expect(history.getResults()).toEqual([result]);
    });
});
