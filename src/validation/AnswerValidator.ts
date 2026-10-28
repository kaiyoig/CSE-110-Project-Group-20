import { AnswerHistory } from "./AnswerHistory";
// import type { ScoreController } from "../score/ScoreController";
// import type { Event } from "../notifications/Event";
// import { EventType } from "../notifications/Event";

interface ScoreActions {
    answerIncorrect(): void;
    roomSolved(kind: "main" | "bonus"): number;
}

//Replace Kaiyo Event type after merging
enum EventType {
    Correct,
    Incorrect
}

interface NotificationActions{
    send(event: {
        eventType: number;
        additionalInfo?: string;
    }): void;
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

        //check if it is final submmited answer (NOT intermediate step) 
        //unlocks room and grants rewards
        } else if (isFinalStep){ 
            this.score.roomSolved("main")
        }
        
        //send notification to notification handler
        this.notifications.send({
        eventType: isCorrect ? EventType.Correct : EventType.Incorrect
        });

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