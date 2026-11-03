/**
 * A fake TextInput (no HTML <input>) for screen tests, used with
 * `vi.mock("../text-input/text-input", () => import("./testing/fakeTextInput"))`.
 * Tests type with `enter(text)`.
 */
import { FakeGroup } from "./fakeKonva";

export const created: FakeTextInput[] = [];

export class FakeTextInput extends FakeGroup {
  value = "";
  options: Record<string, unknown>;
  onTextEntered?: (text: string) => void;
  onTextFocused?: () => void;

  constructor(options: Record<string, any>) {
    super({ visible: false, listening: false });
    this.options = options;
    (options.layer as FakeGroup | undefined)?.add(this);
    created.push(this);
  }

  override show(x?: number, y?: number): this {
    if (x !== undefined && y !== undefined) this.position({ x, y });
    this.attrs.visible = true;
    return this;
  }

  override hide(): this {
    this.attrs.visible = false;
    return this;
  }

  text(): string {
    return this.value;
  }

  clear(): void {
    this.value = "";
  }

  outlineColor(): void {}
  backgroundColor(): void {}
  textColor(): void {}
  enable(): void {}
  disable(): void {}

  /** Types `text` and presses Enter. */
  enter(text: string): void {
    this.value = text;
    this.onTextEntered?.(text);
  }
}

export default FakeTextInput;
