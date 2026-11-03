import { AnswerHistory } from "./AnswerHistory";
// import type { ScoreController } from "../score/ScoreController";
// import type { Event } from "../notifications/Event";
// import { EventType, type GameEvent } from "../notifications/Event";

interface ScoreActions {
    answerIncorrect(): void;
    roomSolved(kind: "main" | "bonus"): number;
}

//TODO: Replace Kaiyo Event type after merging
enum EventType {
    Correct,
    Incorrect
}

//TODO: Change to send(event: GameEvent): void 
//after Notification Manager is merged

interface NotificationActions{
    send(event: {
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

    //TODO: After Question.ts merged
    //Accept Question object instead of question:string
    //keep playerAnswer:string for multi-step questions
    //Use question.answer as the final answer 
    //Seven's component will determine isFinalStep.
    //Update AnswerHistory and unit tests.

    // Future method signature:
    // validateAnswer(
    //     question: Question,
    //     playerAnswer: string,
    //     expectedAnswer: string,
    //     isFinalStep: boolean
    // ): boolean
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
            this.score.roomSolved("main");
        }
        
        //send notification to notification handler
        this.notifications.send({
        eventType: isCorrect ? EventType.Correct : EventType.Incorrect
        });

        //store answer history
        // TODO: After Question.ts is merged:
        // store the Question object and expectedAnswer
        // so incorrect intermediate steps can be reviewed.
        this.history.addResult({
        question: question,
        correctAnswer: correctAnswer,
        playerAnswer: playerAnswer,
        isCorrect: isCorrect
        });

        return isCorrect;
    }


}