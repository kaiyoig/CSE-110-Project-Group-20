import Konva from "konva";
import { INDUSTRIAL } from "../screens/industrial-theme";
import { setCursor } from "../screens/theme";

/** Size of the keypad unit, from its top-left corner. */
export const KEYPAD_WIDTH = 364;
export const KEYPAD_HEIGHT = 480;

/** How long a wrong answer shows "TRY AGAIN" on the display. */
export const WRONG_FLASH_MS = 700;

/** Most lights the "LOCK PINS" row draws; longer puzzles share the row. */
const MAX_LIGHTS = 8;

/** The industrial look shared with the Power Box and the multistep console. */
const STYLE = {
    ...INDUSTRIAL,
    xFace: [0, "#ffe680", 1, "#f5c400"],
} as const;

const PAD = 20;
const LCD = { x: PAD, y: 60, width: KEYPAD_WIDTH - 2 * PAD, height: 80 };
const GRID = { x: PAD, y: 158, gap: 10, rowHeight: 50, cols: 4, rows: 5 };
const COL_WIDTH = (KEYPAD_WIDTH - 2 * PAD - (GRID.cols - 1) * GRID.gap) / GRID.cols;

/** Each key: what it sends, what it shows, and where it sits (1-based grid cells). */
interface KeySpec {
    key: string;
    label: string;
    col: number;
    row: number;
    colSpan?: number;
    rowSpan?: number;
}

const KEYS: KeySpec[] = [
    { key: "x", label: "x", col: 1, row: 1 },
    { key: "/", label: "/", col: 2, row: 1 },
    { key: "-", label: "−", col: 3, row: 1 },
    { key: "⌫", label: "⌫", col: 4, row: 1 },
    { key: "7", label: "7", col: 1, row: 2 },
    { key: "8", label: "8", col: 2, row: 2 },
    { key: "9", label: "9", col: 3, row: 2 },
    { key: "C", label: "C", col: 4, row: 2 },
    { key: "4", label: "4", col: 1, row: 3 },
    { key: "5", label: "5", col: 2, row: 3 },
    { key: "6", label: "6", col: 3, row: 3 },
    { key: "1", label: "1", col: 1, row: 4 },
    { key: "2", label: "2", col: 2, row: 4 },
    { key: "3", label: "3", col: 3, row: 4 },
    { key: "0", label: "0", col: 1, row: 5, colSpan: 3 },
];

const ENTER: KeySpec = { key: "Enter", label: "ENTER", col: 4, row: 3, rowSpan: 3 };

/**
 * The multistep room's answer keypad: a "LOCK PINS" row of lights (one per
 * Step, lit as Steps are solved), a display showing what to work out and the
 * answer so far, and the keys. Every key reports through `onKeyPressed`;
 * ENTER reports through `onSubmit`.
 */
export default class KeypadInput extends Konva.Group {

    /** Called with the pressed key: a digit, "x", "/", "-", "⌫" or "C". */
    public onKeyPressed?: (key: string) => void;
    /** Called when ENTER is pressed. */
    public onSubmit?: () => void;

    private readonly answerDisplay: Konva.Text;
    private readonly promptDisplay: Konva.Text;
    private readonly lights = new Konva.Group({ name: "keypad-lights" });
    private readonly progressText: Konva.Text;
    private readonly keys: Konva.Group[] = [];
    private enabled = true;
    private flashTimer: ReturnType<typeof setTimeout> | null = null;

    constructor() {
        super({ name: "keypad-input" });

        this.add(new Konva.Rect({
            width: KEYPAD_WIDTH, height: KEYPAD_HEIGHT,
            fill: STYLE.housing, stroke: STYLE.housingEdge, strokeWidth: 4,
            cornerRadius: 18, listening: false,
        }));

        this.add(new Konva.Text({
            x: PAD, y: 18, height: 28, verticalAlign: "middle",
            text: "LOCK PINS", fontFamily: STYLE.title, fontStyle: "600",
            fontSize: 15, letterSpacing: 2, fill: STYLE.housingText, listening: false,
        }));
        this.add(this.lights);
        this.progressText = new Konva.Text({
            x: KEYPAD_WIDTH - PAD - 60, y: 18, width: 60, height: 28,
            align: "right", verticalAlign: "middle",
            fontFamily: STYLE.mono, fontStyle: "bold", fontSize: 20,
            fill: STYLE.wrongText, listening: false, name: "keypad-progress",
        });
        this.add(this.progressText);

        this.add(new Konva.Rect({
            ...LCD, fill: STYLE.lcd, stroke: STYLE.housingEdge, strokeWidth: 4,
            cornerRadius: 10, listening: false,
        }));
        this.promptDisplay = new Konva.Text({
            x: LCD.x + 16, y: LCD.y + 10, width: LCD.width - 32,
            fontFamily: STYLE.mono, fontStyle: "bold", fontSize: 18,
            fill: STYLE.lcdDim, listening: false, wrap: "none", ellipsis: true,
            name: "keypad-prompt",
        });
        this.answerDisplay = new Konva.Text({
            x: LCD.x + 16, y: LCD.y + 34, width: LCD.width - 32, height: 38,
            align: "right", verticalAlign: "middle",
            fontFamily: STYLE.mono, fontStyle: "bold", fontSize: 32,
            fill: STYLE.lcdText, listening: false, wrap: "none",
            name: "keypad-answer",
        });
        this.add(this.promptDisplay, this.answerDisplay);

        for (const spec of KEYS) this.addKey(spec, STYLE.keyFace, () => this.onKeyPressed?.(spec.key));
        this.addKey(ENTER, STYLE.keyGo, () => this.onSubmit?.(), 17);

        this.setProgress(0, 0);
        this.setPrompt("");
        this.setAnswer();
    }

    /** Shows the typed answer, or a "?" placeholder when it is empty. */
    public setAnswer(answer?: string): void {
        this.clearFlash();
        this.answerDisplay.text(answer ? displayAnswer(answer) : "?");
        this.answerDisplay.fill(answer ? STYLE.lcdText : STYLE.lcdPlaceholder);
        this.getLayer()?.batchDraw();
    }

    /** The small line above the answer, e.g. "14 + 7 =". */
    public setPrompt(text: string): void {
        this.promptDisplay.text(text);
        this.getLayer()?.batchDraw();
    }

    /**
     * One light per Step of `par` (the fewest Steps that solve the equation),
     * lit for each Step solved. The lights never change in number: a longer
     * way round shows its extra Steps beside them as "+1", "+2"…
     */
    public setProgress(solved: number, par: number): void {
        const count = Math.max(0, Math.min(MAX_LIGHTS, Math.floor(par)));
        const on = Math.max(0, Math.min(count, Math.floor(solved)));
        this.lights.destroyChildren();
        // The lights share the space between the label and the "lit/total" count.
        const spacing = count > 0 ? Math.min(32, 160 / count) : 0;
        const radius = Math.min(13, spacing / 2 - 2);
        const startX = 212 - ((count - 1) * spacing) / 2;
        for (let i = 0; i < count; i++) {
            const isOn = i < on;
            this.lights.add(new Konva.Circle({
                x: startX + i * spacing, y: 32, radius,
                fill: isOn ? STYLE.ledOn : STYLE.ledOff,
                stroke: "#0d0e10", strokeWidth: 3,
                shadowColor: STYLE.ledOn, shadowBlur: isOn ? 14 : 0, shadowOpacity: isOn ? 0.9 : 0,
                listening: false, name: isOn ? "light-on" : "light-off",
            }));
        }
        const extra = Math.max(0, Math.floor(solved) - Math.floor(par));
        this.progressText.text(par > 0 ? (extra > 0 ? `+${extra}` : `${on}/${par}`) : "");
        this.progressText.fill(extra > 0 ? STYLE.hazard : solved > 0 ? STYLE.ledOn : STYLE.wrongText);
        this.getLayer()?.batchDraw();
    }

    /** Turns the keys on or off (off: dimmed and not clickable). */
    public setEnabled(enabled: boolean): void {
        this.enabled = enabled;
        for (const key of this.keys) {
            key.opacity(enabled ? 1 : 0.38);
            key.listening(enabled);
        }
        this.getLayer()?.batchDraw();
    }

    public isEnabled(): boolean {
        return this.enabled;
    }

    /** Shows "TRY AGAIN" in red for a moment after a wrong answer. */
    public flashWrong(): void {
        this.clearFlash();
        this.answerDisplay.text("TRY AGAIN");
        this.answerDisplay.fill(STYLE.wrongText);
        this.getLayer()?.batchDraw();
        this.flashTimer = setTimeout(() => {
            this.flashTimer = null;
            this.setAnswer();
        }, WRONG_FLASH_MS);
    }

    /** Shows a final result, e.g. "x = 7", in the answer line. */
    public showResult(text: string): void {
        this.clearFlash();
        this.answerDisplay.text(displayAnswer(text));
        this.answerDisplay.fill(STYLE.ledOn);
        this.getLayer()?.batchDraw();
    }

    public destroy(): this {
        this.clearFlash();
        return super.destroy();
    }

    private clearFlash(): void {
        if (this.flashTimer !== null) clearTimeout(this.flashTimer);
        this.flashTimer = null;
    }

    private addKey(spec: KeySpec, face: readonly (string | number)[], press: () => void, fontSize = 28): void {
        const x = GRID.x + (spec.col - 1) * (COL_WIDTH + GRID.gap);
        const y = GRID.y + (spec.row - 1) * (GRID.rowHeight + GRID.gap);
        const width = (spec.colSpan ?? 1) * COL_WIDTH + ((spec.colSpan ?? 1) - 1) * GRID.gap;
        const height = (spec.rowSpan ?? 1) * GRID.rowHeight + ((spec.rowSpan ?? 1) - 1) * GRID.gap;
        const faceStops = spec.key === "x" ? STYLE.xFace : face;

        const button = new Konva.Group({ x, y, name: `key key-${spec.key}` });
        button.add(new Konva.Rect({
            y: 6, width, height, cornerRadius: 12, fill: STYLE.edge, listening: false,
        }));
        const top = new Konva.Group({ name: "key-top" });
        top.add(new Konva.Rect({
            width, height, cornerRadius: 12,
            fillLinearGradientStartPoint: { x: 0, y: 0 },
            fillLinearGradientEndPoint: { x: 0, y: height },
            fillLinearGradientColorStops: [...faceStops],
            stroke: STYLE.edge, strokeWidth: 3,
        }));
        top.add(new Konva.Text({
            width, height, align: "center", verticalAlign: "middle",
            text: spec.label, fontFamily: STYLE.title, fontStyle: "bold",
            fontSize, fill: STYLE.keyText, listening: false, wrap: "none",
        }));
        button.add(top);

        button.on("mouseenter", () => setCursor(button, "pointer"));
        button.on("mouseleave", () => { setCursor(button, ""); top.y(0); });
        button.on("mousedown touchstart", () => { top.y(3); this.getLayer()?.batchDraw(); });
        button.on("mouseup touchend", () => { top.y(0); this.getLayer()?.batchDraw(); });
        button.on("click tap", () => {
            if (this.enabled) press();
        });

        this.keys.push(button);
        this.add(button);
    }
}

/** "-12" shows as "−12" and "3x" stays "3x"; a typed "-" alone shows as "−". */
function displayAnswer(answer: string): string {
    return answer.replace(/-/g, "−");
}

