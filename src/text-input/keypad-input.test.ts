import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("konva", () => import("../screens/testing/fakeKonva"));

import KeypadInput, { WRONG_FLASH_MS } from "./keypad-input";
import type { FakeNode } from "../screens/testing/fakeKonva";

function node(keypad: KeypadInput, name: string): FakeNode {
    const found = (keypad as unknown as FakeNode).findOne(`.${name}`);
    if (!found) throw new Error(`No .${name} in the keypad`);
    return found;
}

const answer = (keypad: KeypadInput) => node(keypad, "keypad-answer").text();

describe("KeypadInput", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("reports digits, x, / and − by the key each one stands for", () => {
        const keypad = new KeypadInput();
        const onKeyPressed = vi.fn();
        keypad.onKeyPressed = onKeyPressed;

        for (const key of ["5", "x", "/", "-", "C", "⌫"]) node(keypad, `key-${key}`).fire("click");

        expect(onKeyPressed.mock.calls.map(([key]) => key)).toEqual(["5", "x", "/", "-", "C", "⌫"]);
    });

    it("has an x key and a key for every digit", () => {
        const keypad = new KeypadInput();
        for (const key of ["x", "0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]) {
            expect(() => node(keypad, `key-${key}`)).not.toThrow();
        }
    });

    it("calls onSubmit when ENTER is pressed", () => {
        const keypad = new KeypadInput();
        const onSubmit = vi.fn();
        keypad.onSubmit = onSubmit;

        node(keypad, "key-Enter").fire("click");

        expect(onSubmit).toHaveBeenCalledOnce();
    });

    it("ignores and dims its keys while disabled", () => {
        const keypad = new KeypadInput();
        const onKeyPressed = vi.fn();
        keypad.onKeyPressed = onKeyPressed;

        keypad.setEnabled(false);
        node(keypad, "key-5").fire("click");

        expect(onKeyPressed).not.toHaveBeenCalled();
        expect(node(keypad, "key-5").opacity()).toBeLessThan(1);
        expect(keypad.isEnabled()).toBe(false);
    });

    it("shows the answer with a real minus sign, or ? when empty", () => {
        const keypad = new KeypadInput();

        keypad.setAnswer("-3/4");
        expect(answer(keypad)).toBe("−3/4");

        keypad.setAnswer();
        expect(answer(keypad)).toBe("?");
    });

    it("shows what to work out above the answer", () => {
        const keypad = new KeypadInput();
        keypad.setPrompt("14 + 7 =");
        expect(node(keypad, "keypad-prompt").text()).toBe("14 + 7 =");
    });

    it("lights one lock pin per solved Step, with one light per Step of par", () => {
        const keypad = new KeypadInput();

        keypad.setProgress(1, 4);

        const lights = (keypad as unknown as FakeNode).find((n) => /light-(on|off)/.test(String(n.name())));
        expect(lights).toHaveLength(4);
        expect(lights.filter((n) => n.name() === "light-on")).toHaveLength(1);
        expect(node(keypad, "keypad-progress").text()).toBe("1/4");
    });

    it("keeps the lights at par and shows Steps beyond it as +n", () => {
        const keypad = new KeypadInput();
        keypad.setProgress(5, 3);
        const lights = (keypad as unknown as FakeNode).find((n) => /light-(on|off)/.test(String(n.name())));
        expect(lights).toHaveLength(3);
        expect(lights.every((n) => n.name() === "light-on")).toBe(true);
        expect(node(keypad, "keypad-progress").text()).toBe("+2");
    });

    it("flashes TRY AGAIN after a wrong answer, then clears", () => {
        vi.useFakeTimers();
        const keypad = new KeypadInput();

        keypad.flashWrong();
        expect(answer(keypad)).toBe("TRY AGAIN");

        vi.advanceTimersByTime(WRONG_FLASH_MS);
        expect(answer(keypad)).toBe("?");
    });
});
