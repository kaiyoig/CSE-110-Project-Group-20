import { AnswerHistory } from "./AnswerHistory";
import type { NotificationManager } from "../notification-manager/NotificationManager";
import { EventType } from "../notification-manager/GameEvent";
import type { Question, StepAnswer } from "../questions/Question";
import type { RoomKind, ScoreController } from "../score";

/** The part of ScoreController the validator calls. */
export type ScoreActions = Pick<ScoreController, "answerIncorrect" | "roomSolved">;

/**
 * Judges each Step's Answer, makes the score call, sends Correct/Incorrect
 * and records the Answer in AnswerHistory.
 */
export class AnswerValidator {
    private history: AnswerHistory;
    private score: ScoreActions;
    private notifications: NotificationManager;

    constructor(history: AnswerHistory, score: ScoreActions, notifications: NotificationManager) {
        this.history = history;
        this.score = score;
        this.notifications = notifications;
    }

    /**
     * Incorrect → time penalty. Correct last Step → the Room is Solved.
     * Correct earlier Step → no score change. Returns whether it was correct.
     */
    validateAnswer(question: Question, answer: StepAnswer, kind: RoomKind): boolean {
        const isCorrect = answer.playerAnswer.trim() === answer.correctAnswer.trim();

        if (!isCorrect) {
            this.score.answerIncorrect();
        } else if (answer.isLastStep) {
            this.score.roomSolved(kind);
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
