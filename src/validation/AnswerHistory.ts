export interface ProblemResult{
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