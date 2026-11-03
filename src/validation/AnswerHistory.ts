//import type {Question} from "../questions/Questions"

export interface ProblemResult{
    //TODO: after Question.ts merged,
    //1. Import Question.ts from question generator
    //2. change question: string; and correctAnswer:string to question:Question
    //3. update unit test and answer validator
    question: string;
    correctAnswer: string;

    playerAnswer: string;
    isCorrect: boolean;
}

export class AnswerHistory{
    private results: ProblemResult[] = [];

    addResult(result: ProblemResult): void{
        this.results.push(result);
    }

    getResults(): ProblemResult[]{
        //creates a copy of array, so other components don't modify
        return [...this.results];
    }
}