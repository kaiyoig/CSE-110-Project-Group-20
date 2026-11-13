# Radio Button Usage

`RadioButton` is a Konva group containing an outer circle and a selected-state inner circle. Add it to a Konva layer and assign its `onClick` callback.

```ts
import RadioButton from './radio-button'

const button = new RadioButton(
  28,
  '#ffffff', // selected fill
  '#4b5563', // unselected fill
  '#ffffff', // outline
)

button.position({ x: 200, y: 150 })
button.onClick = () => {
  console.log('Selected:', button.isClicked())
}
layer.add(button)
```

Use the state methods to control interaction:

```ts
button.click()
button.isClicked() // true

button.clear()
button.enable()
button.disable()
```

Clicking an already-selected button has no effect and does not fire `onClick` again. `disable()` also prevents click events; call `enable()` to make the button interactive again.
