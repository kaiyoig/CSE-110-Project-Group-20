import { AnswerHistory } from "./AnswerHistory";

interface ScoreActions {
    answerIncorrect(): void;
    roomSolved(kind: "main" | "bonus"): number;
}

export class AnswerValidator{
    private history: AnswerHistory;
    private score: ScoreActions;

    constructor(history: AnswerHistory, score:ScoreActions){
        this.history = history;
        this.score = score;
    }

    validateAnswer(
        question: string, 
        playerAnswer: string, 
        correctAnswer:string,
        isFinalStep: boolean
    ): boolean {
        //determine if answer is correct
        const isCorrect = playerAnswer.trim() === correctAnswer.trim();
        //if incorrect deduct from time from score controller
        if(!isCorrect){
            this.score.answerIncorrect();
        //check if it is final submmited answer (NOT submitted part) 
        //unlocks room and grants rewards
        } else if (isFinalStep){ 
            this.score.roomSolved("main")
        }

        //store answer history
        this.history.addResult({
        question: question,
        correctAnswer: correctAnswer,
        playerAnswer: playerAnswer,
        isCorrect: isCorrect
        });

        return isCorrect;
    }


}