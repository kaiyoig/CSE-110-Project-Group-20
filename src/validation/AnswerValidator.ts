import { AnswerHistory } from "./AnswerHistory";
import type { NotificationManager } from "../notification-manager/NotificationManager";
import { EventType } from "../notification-manager/GameEvent";
import type { Question, StepAnswer } from "../questions/Question";
import type { RoomKind } from "../map/Room";

/**
 * Judges each Step's Answer, sends the events for it and records the Answer
 * in AnswerHistory. The score listens to those events (ScoreController.listenTo).
 */
export class AnswerValidator {
    private history: AnswerHistory;
    private notifications: NotificationManager;

    constructor(history: AnswerHistory, notifications: NotificationManager) {
        this.history = history;
        this.notifications = notifications;
    }

    /**
     * Incorrect → Incorrect (the score takes the time penalty).
     * Correct last Step → RoomSolved, then Correct.
     * Correct earlier Step → Correct only. Returns whether it was correct.
     */
    validateAnswer(question: Question, answer: StepAnswer, kind: RoomKind): boolean {
        const isCorrect = answer.playerAnswer.trim() === answer.correctAnswer.trim();

        if (isCorrect && answer.isLastStep) {
            this.notifications.send({ eventType: EventType.RoomSolved, roomKind: kind });
        }

        this.notifications.send({
            eventType: isCorrect ? EventType.Correct : EventType.Incorrect,
        });

        this.history.addResult({
            question,
            playerAnswer: answer.playerAnswer,
            correctAnswer: answer.correctAnswer,
            isCorrect,
            isLastStep: answer.isLastStep,
        });

        return isCorrect;
    }
}
