import { AnswerHistory } from "./AnswerHistory";
import type { Question } from "../questions/Question";
import { EventType, type GameEvent } from "../notification-manager/GameEvent";

interface ScoreActions {
    answerIncorrect(): void;
    roomSolved(kind: "main" | "bonus"): number;
}

interface NotificationActions{
    send(event: GameEvent): void;
}

export class AnswerValidator{
    private history: AnswerHistory;
    private score: ScoreActions;
    private notifications: NotificationActions;

    constructor(history: AnswerHistory, score:ScoreActions, 
        notifications:NotificationActions){
        this.history = history;
        this.score = score;
        this.notifications = notifications;
    }

    validateAnswer(
        question: Question, 
        playerAnswer: string, 
        expectedAnswer:string,
        isFinalStep: boolean
    ): boolean {
        //determine if answer is correct
        const isCorrect = playerAnswer.trim() === expectedAnswer.trim();

        //if incorrect deduct from time from score controller
        if(!isCorrect){
            this.score.answerIncorrect();


        //check if it is final submmited answer (NOT intermediate step) 
        //calls score controller to reward room completion
        } else if (isFinalStep){ 
            this.score.roomSolved("main");
        }
        
        //send notification to notification handler
        this.notifications.send({
        eventType: isCorrect ? EventType.Correct : EventType.Incorrect
        });

        this.history.addResult({
        question: question,
        expectedAnswer: expectedAnswer,
        playerAnswer: playerAnswer,
        isCorrect: isCorrect
        });

        return isCorrect;
    }


}