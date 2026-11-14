
import { describe, it, expect, vi, beforeEach } from "vitest";
import type Konva from "konva";

vi.mock("konva", () => import("../screens/testing/fakeKonva"));

const mocks = vi.hoisted(() => ({
    arithmetic: vi.fn(),
    step: vi.fn()
}));

vi.mock("../text-input/text-input", () => ({
    default: class {
        show() {}
        hide() {}
        clear() {}
        outlineColor() {}
        destroy() {}
    }
}));

vi.mock("../multistep-solver/multistep-solver-view", () => ({
    default: class {
        setPosition() {}
        destroy() {}
    }
}));

vi.mock("../multistep-solver/multistep-solver-controller", () => ({
    default: class {
        onAnswerSubmit?: (
            question: string,
            playerAnswer: string,
            correctAnswer: string,
            isLastStep: boolean
        ) => void;

        onStateChange?: (state: string) => void;

        setEquation() {}
        arithmetic = mocks.arithmetic;
        step = mocks.step;
        operation() {}
        removeNegativeSign() {}
        moveRequest() {}
    }
}));

import BasicMultistepPuzzle from "./basic-multistep-puzzle";
import type KeypadInput from "../text-input/keypad-input";
import { FakeStage, FakeLayer } from "../screens/testing/fakeKonva";

function createPuzzle() {
    const stage = new FakeStage();
    const layer = new FakeLayer();
    stage.add(layer);

    const puzzle = new BasicMultistepPuzzle("x+1=3", {
        layer: layer as unknown as Konva.Layer,
        x: 700,
        y: 450,
        width: 960,
        height: 480,
        spacing: 24,
        inputType: "keypad"
    });

    return puzzle as unknown as {
        keypad: KeypadInput;
        controller: {
            onAnswerSubmit?: (
                question: string,
                playerAnswer: string,
                correctAnswer: string,
                isLastStep: boolean
            ) => void;
        };
    };
}

describe("BasicMultistepPuzzle keypad", () => {

    beforeEach(() => {
        vi.clearAllMocks();
    });

    //Test 1: Valid fractions are submitted to solver
    it("submits a valid fraction", () => {
        const { keypad } = createPuzzle();

        keypad.onKeyPressed?.("1");
        keypad.onKeyPressed?.("/");
        keypad.onKeyPressed?.("2");
        keypad.onSubmit?.();

        expect(mocks.arithmetic).toHaveBeenCalledWith("1/2");
    });

    //Test 2: Negative fractions are supported
    it("submits a negative fraction", () => {
        const { keypad } = createPuzzle();

        keypad.onKeyPressed?.("-");
        keypad.onKeyPressed?.("3");
        keypad.onKeyPressed?.("/");
        keypad.onKeyPressed?.("4");
        keypad.onSubmit?.();

        expect(mocks.arithmetic).toHaveBeenCalledWith("-3/4");
    });

    //Test 3: Invalid fractions cannot be submitted
    it("rejects incomplete fractions and division by zero", () => {
        const { keypad } = createPuzzle();

        keypad.onKeyPressed?.("1");
        keypad.onKeyPressed?.("/");
        keypad.onSubmit?.();

        expect(mocks.arithmetic).not.toHaveBeenCalled();

        keypad.onKeyPressed?.("0");
        keypad.onSubmit?.();

        expect(mocks.arithmetic).not.toHaveBeenCalled();
    });
   
    //Test 4: Clear and backspace delete answer 
    it("handles clear and backspace correctly", () => {
        const { keypad } = createPuzzle();

        keypad.onKeyPressed?.("1");
        keypad.onKeyPressed?.("2");
        keypad.onKeyPressed?.("⌫");
        keypad.onSubmit?.();

        expect(mocks.arithmetic).toHaveBeenCalledWith("1");

        mocks.arithmetic.mockClear();

        keypad.onKeyPressed?.("C");
        keypad.onSubmit?.();

        expect(mocks.arithmetic).not.toHaveBeenCalled();
    });

    //Test 5: Submitting an answer resets the keypad
    it("clears the stored answer after it is judged", () => {
        const { keypad, controller } = createPuzzle();

        keypad.onKeyPressed?.("5");

        controller.onAnswerSubmit?.(
            "x+1=3", "5", "5", false
        );

        keypad.onSubmit?.();

        expect(mocks.arithmetic).not.toHaveBeenCalled();
        expect(mocks.step).toHaveBeenCalledOnce();
    });
});
