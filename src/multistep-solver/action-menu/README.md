# Action Menu Usage

`ActionMenu` is a four-quadrant Konva operation picker for `+`, `-`, `*`, and `/`.

```ts
const menu = new ActionMenu(64, 64)
layer.add(menu)
```

Assign callbacks for the operations you want to handle:

```ts
menu.onAdditionClicked = () => controller.moveRequest('+')
menu.onSubtractionClicked = () => controller.moveRequest('-')
menu.onMultiplicationClicked = () => controller.moveRequest('*')
menu.onDivisionClicked = () => controller.moveRequest('/')
```

Show the menu centered at a position and hide it when it is no longer needed:

```ts
menu.show(500, 300)
menu.hide()
```

`show(x, y)` enables interaction. `hide()` disables interaction and resets any hover highlight.

The menu must be added to a Konva layer before it can be displayed.
