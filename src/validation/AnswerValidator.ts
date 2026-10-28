import { AnswerHistory } from "./AnswerHistory";

export class AnswerValidator{
    private history: AnswerHistory;

    constructor(history: AnswerHistory){
        this.history = history;
    }

    validateAnswer(
        question: string, 
        playerAnswer: string, 
        correctAnswer:string
    ): boolean {
        const isCorrect = playerAnswer.trim() === correctAnswer.trimEnd();

        this.history.addResult({
        question: question,
        correctAnswer: correctAnswer,
        playerAnswer: playerAnswer,
        isCorrect: isCorrect
        });

        return isCorrect;
    }


}