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
