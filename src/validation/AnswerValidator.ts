import { AnswerHistory } from "./AnswerHistory";
import type { NotificationManager } from "../notification-manager/NotificationManager";
import { EventType } from "../notification-manager/GameEvent";
import { solvesRoom, type Question, type StepAnswer } from "../questions/Question";
import type { RoomKind } from "../map/Room";
import { acceptableArithmeticAnswer, equivalentArithmeticExpressions } from "../multistep-solver/arithmetic-expression";

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
     * Correct Answer that solves the Room (see `solvesRoom`) → RoomSolved, then Correct.
     * Any other correct Answer → Correct only. Returns whether it was correct.
     * `question` is the Question the Answer is recorded under.
     * `roomId` is required so scoring applies that Room's hint deductions.
     */
    validateAnswer(question: Question, answer: StepAnswer, kind: RoomKind,
        roomId: string, stepNumber?: number): boolean {
        // Only the multistep solver's arithmetic answers use the strict
        // evaluator. Other puzzles also use stepPrompt for display/review
        // text, so stepPrompt alone is not a sufficient discriminator.
        const isCorrect = answer.isMultistepArithmetic && answer.stepPrompt !== undefined
            ? acceptableArithmeticAnswer(answer.playerAnswer, answer.stepPrompt, answer.correctAnswer)
            : answer.playerAnswer.trim() === answer.correctAnswer.trim() ||
              equivalentArithmeticExpressions(answer.playerAnswer, answer.correctAnswer);

        if (isCorrect && solvesRoom(answer)) {
            this.notifications.send({ eventType: EventType.RoomSolved, roomKind: kind, roomId });
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
            stepPrompt: answer.stepPrompt,
            ...(stepNumber !== undefined ? { stepNumber } : {}),
        });

        return isCorrect;
    }
}
