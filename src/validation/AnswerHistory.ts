import type { Question } from "../questions/Question";

/** One judged Step Answer. */
export interface AnswerRecord {
    question: Question;
    playerAnswer: string;
    correctAnswer: string;
    isCorrect: boolean;
    isLastStep: boolean;
}

/** Every Answer given during one Heist, in order. */
export class AnswerHistory {
    private results: AnswerRecord[] = [];

    addResult(result: AnswerRecord): void {
        this.results.push(result);
    }

    getResults(): AnswerRecord[] {
        // a copy, so other components can't modify the history
        return [...this.results];
    }
}
