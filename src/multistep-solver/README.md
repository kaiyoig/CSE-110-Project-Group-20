# Multistep Solver Usage

The easiest way to use the solver is through `BasicMultistepPuzzle`, which combines the model, view, controller, action menu, and text input.

```ts
const puzzle = new BasicMultistepPuzzle('x * 5 + 3 = 8', {
  layer,
  x: 960,
  y: 300,
  width: 700,
  height: 400,
  spacing: 24,
  blockSize: 32,
  panelColor: '#4b5563',
})

puzzle.onPuzzleFinished = solved => {
  console.log(solved ? 'Solved' : 'Failed')
}
```

The supplied layer must already be attached to a Konva stage. The panel position is centered on `x, y`. `spacing`, `blockSize`, and `panelColor` control the layout and appearance. Action-menu and input dimensions can also be supplied with `actionMenuWidth`, `actionMenuHeight`, `inputWidth`, and `inputHeight`.

## Manual MVC usage

For separate control, create a model, view, and controller:

```ts
const model = new MultistepSolverModel()
const view = new MultistepSolverView(stage, layer, {
  panelWidth: 700,
  panelHeight: 400,
})
const controller = new MultistepSolverController(model, view)

controller.setEquation('x * 5 + 3 = 8')
```

The controller states are `Idle`, `Operation`, `Arithmetic`, and `Finished`.

Connect view events to the controller:

```ts
view.onTargetDropped = (index, isLeftSide) => {
  controller.operation(index, isLeftSide)
}
```

Use `controller.onStateChange` to activate the appropriate external control. Submit operation choices with `moveRequest(operation)` and arithmetic answers with `arithmetic(answer)`. Call `step()` after a correct submitted answer.

Useful controller methods:

- `setEquation(equation)` loads a new equation.
- `operation(index, isLeftSide)` requests a term move.
- `moveRequest(operation)` submits `+`, `-`, `*`, or `/`.
- `arithmetic(answer)` submits an arithmetic result.
- `step()` applies an accepted answer.
- `fail()` ends the puzzle as failed.

The model stores additive signs on term values. The view renders the corresponding `+` and `-` blocks automatically.
