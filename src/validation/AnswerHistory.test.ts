import { describe, it, expect } from "vitest";
import { AnswerHistory } from "./AnswerHistory";

describe("AnswerHistory", () => {
    it("Should Start With An Empty History", () =>{
        const history = new AnswerHistory();

        expect(history.getResults()).toEqual([]);
    });


    it("Should Store A Question", () =>{
        const history = new AnswerHistory();
        const result = {
            question: "5 +3 = ?",
            correctAnswer: "8",
            playerAnswer: "8",
            isCorrect: true
        };
        
        history.addResult(result);
        expect(history.getResults()).toEqual([result]);

    });

    
    it("Should Protect Original History", () => {
    const history = new AnswerHistory();

    const result = {
        question: "5 + 3 = ?",
        correctAnswer: "8",
        playerAnswer: "8",
        isCorrect: true
    };

    history.addResult(result);

    const copiedResults = history.getResults();

    copiedResults.pop();

    expect(history.getResults()).toEqual([result]);


    });
    
});