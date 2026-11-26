# Text Input Usage

`TextInput` provides a styled Konva rectangle with an HTML text input managed internally.

```ts
const input = new TextInput({
  layer,
  x: 500,
  y: 300,
  width: 160,
  height: 50,
  backgroundColor: '#eeeeee',
  foregroundColor: '#000000',
  ghostText: 'Enter answer',
  ghostTextColor: '#888888',
})
```

The layer must already be attached to a Konva stage. Show and hide the input with:

```ts
input.show(500, 300)
input.hide()
```

Assign callbacks for focus and submitted text:

```ts
input.onTextFocused = () => {
  input.outlineColor('#77aaff')
}

input.onTextEntered = text => {
  console.log(text)
  input.clear()
}
```

Text is submitted when the user presses Enter or focuses another element. Incorrect answers can be cleared and submitted again.

Available controls:

- `text()` returns the current text.
- `clear()` empties the input.
- `textColor(color)` changes the text color.
- `ghostTextColor(color)` changes the placeholder color.
- `backgroundColor(color)` changes the Konva rectangle color.
- `outlineColor(color)` changes the outline color.
- `disable()` prevents typing and focus.
- `enable()` restores typing and focus.


# Keypad Input Usage

`KeypadInput` is the multistep room's answer keypad, styled like the Power Box:
a "LOCK PINS" row of lights, a display, and the keys.

## How It Works

- Keys: digits, `x`, `/` (fractions), `−` (toggles the sign), `⌫` (backspace),
  `C` (clear) and a tall `ENTER`.
- The **LOCK PINS** row: `setProgress(solved, par)` draws one light per Step of par and lights one per Step solved; Steps beyond par show as "+1", "+2"… without adding lights.
- The display shows what to work out (`setPrompt("14 + 7 =")`) above the answer
  typed so far (`setAnswer("21")`, or `setAnswer()` for the `?` placeholder).
- `flashWrong()` shows "TRY AGAIN" in red for a moment; `showResult("x = 7")`
  shows the final answer in green.
- `setEnabled(false)` dims the keys and ignores clicks (between Arithmetic Steps).
- The keypad is 364 × 480 (`KEYPAD_WIDTH`, `KEYPAD_HEIGHT`), placed from its top-left.

## Usage

```ts
const keypad = new KeypadInput();
keypad.position({ x, y });
layer.add(keypad);

keypad.onKeyPressed = (key) => {
  // "0"–"9", "x", "/", "-", "⌫" or "C"
};

keypad.onSubmit = () => {
  // ENTER: check the player's answer
};
```

`BasicMultistepPuzzle` also maps the keyboard to the same keys (digits, `x`,
`-`, `/`, Backspace, Escape/Delete to clear, Enter to submit) during an
Arithmetic Step.

## Related Files

- `keypad-input.ts` — Keypad layout, lights, display and keys.
- `../puzzles/basic-multistep-puzzle.ts` — Turns key presses into answers
  (`normalizeKeypadAnswer`: `3x` becomes `x * 3`) and submits them.
