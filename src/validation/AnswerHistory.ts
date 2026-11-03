/**
 * Gets all the answers stored in history.
 * Returns a copy so other components can't change the original array.
 *
 * @returns A copy of the stored answer results.
 */
import type {Question} from "../questions/Question"
export interface ProblemResult{
    question: Question;
    expectedAnswer: string;
    playerAnswer: string;
    isCorrect: boolean;
}

export class AnswerHistory{
    private results: ProblemResult[] = [];

    addResult(result: ProblemResult): void{
        this.results.push(result);
    }

    getResults(): ProblemResult[]{
        //creates a copy of array, so other components don't directly modify
        //original array
        return [...this.results];
    }
}