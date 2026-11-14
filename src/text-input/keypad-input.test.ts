
import { describe, it, expect, vi } from "vitest";

vi.mock("konva", () => import("../screens/testing/fakeKonva"));

import KeypadInput from "./keypad-input";
import {
    FakeNode,
    FakeGroup,
    FakeText,
    textNodes
} from "../screens/testing/fakeKonva";

describe("KeypadInput", () => {

    // Finds a button based on its displayed text
    function findButton(keypad: KeypadInput, label: string) {
        const node = keypad as unknown as FakeNode;

        const button = node.getChildren().find(child =>
            child instanceof FakeGroup &&
            child.getChildren().some(inner =>
                inner instanceof FakeText && inner.text() === label
            )
        );

        if (!button) throw new Error(`Button ${label} not found`);

        return button;
    }

    //Test 1: Number button triggers correctly
    it("calls onKeyPressed when a number is clicked", () => {
        const keypad = new KeypadInput();
        const onKeyPressed = vi.fn();

        keypad.onKeyPressed = onKeyPressed;

        findButton(keypad, "5").fire("click");

        expect(onKeyPressed).toHaveBeenCalledWith("5");
    });

    //Test 2: Fraction and clear triggers correctly
    it("supports fraction and clear button callbacks", () => {
        const keypad = new KeypadInput();
        const onKeyPressed = vi.fn();

        keypad.onKeyPressed = onKeyPressed;

        findButton(keypad, "/").fire("click");
        findButton(keypad, "C").fire("click");

        expect(onKeyPressed).toHaveBeenNthCalledWith(1, "/");
        expect(onKeyPressed).toHaveBeenNthCalledWith(2, "C");
    });


    //Test 3: Submit button triggers correctly
    it("calls onSubmit when Submit is clicked", () => {
        const keypad = new KeypadInput();
        const onSubmit = vi.fn();

        keypad.onSubmit = onSubmit;

        findButton(keypad, "Submit").fire("click");

        expect(onSubmit).toHaveBeenCalledOnce();
    });

    it("updates the answer display", () => {
        const keypad = new KeypadInput();

        keypad.setAnswer("1/2");

        expect(textNodes(keypad).map(node => node.text()))
            .toContain("1/2");
    });
});
