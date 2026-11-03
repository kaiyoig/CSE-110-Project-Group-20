import { describe, it, expect } from "vitest";
import { AnswerHistory } from "./AnswerHistory";

describe("AnswerHistory", () => {
    //Test 1: Checks empty history
    it("Should Start With An Empty History", () =>{
        const history = new AnswerHistory();

        expect(history.getResults()).toEqual([]);
    });


    it("Should Store A Question", () =>{
        const history = new AnswerHistory();
        const result = {
        question: {
            prompt: "5 + 3 = ?",
            answer: "8"
        },
        expectedAnswer: "8",
        playerAnswer: "8",
        isCorrect: true
    };
        
        history.addResult(result);
        expect(history.getResults()).toEqual([result]);

    });

    //Test 2: Checks that original array is protected
    it("Should Protect Original History", () => {
    const history = new AnswerHistory();

    const result = {
        question: {
            prompt: "5 + 3 = ?",
            answer: "8"
        },
        expectedAnswer: "8",
        playerAnswer: "8",
        isCorrect: true
    };

    history.addResult(result);

    const copiedResults = history.getResults();

    copiedResults.pop();

    expect(history.getResults()).toEqual([result]);


    });
    
});