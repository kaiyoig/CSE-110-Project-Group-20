# Graph and Laser-Match Usage

## Creating graphs

`Graph` creates Konva groups containing a curve, axes, integer tick marks, and labels. The graph configuration uses `minX`, `maxX`, `minY`, and `maxY`; `stepSize`, stretch values, and the curve color are optional.

```ts
import Graph from './graph'

const line = Graph.createLine({
  minX: -3,
  maxX: 3,
  minY: -3,
  maxY: 3,
  slope: 2,
  yOffset: 1,
  xStretch: 20,
  yStretch: 20,
  lineColor: '#2f80ed',
})

const quadratic = Graph.createQuadratic({
  minX: -3,
  maxX: 3,
  minY: -3,
  maxY: 3,
  a: -1,
  b: 0,
  c: 2,
  stepSize: 0.01,
  lineColor: '#eb5757',
})

layer.add(line)
layer.add(quadratic)
```

`parseEquation` accepts numeric linear and quadratic equations, including signed terms:

```ts
import { equationFromConfig, parseEquation } from './graph'

const config = parseEquation('y = -2 * x * x + 3 * x - 1')
const equation = equationFromConfig(config)
// equation: 'y = -2 * x * x + 3 * x - 1'
```

Equation parsing supplies default bounds from `-3` through `3` on both axes.

## Graph-match model

`GraphMatchModel` stores each equation and its Konva graph as a tuple. It accepts either a graph configuration or an equation string.

```ts
import GraphMatchModel from './graph-match-model'

const model = new GraphMatchModel()
model.addGraph('y = 2 * x + 1')
model.addGraph({
  minX: -3,
  maxX: 3,
  minY: -3,
  maxY: 3,
  a: 1,
  b: 0,
  c: -2,
})

const entries = model.graphs()
const graph = model.get(0)
```

`graphs()` returns `[equation, graph]` entries in insertion order. `get(index)` returns the graph for that model index.

## Laser-match view

The view lays out equations on the left and shuffled graph groups on the right. The `x` and `y` options represent the center of the panel, and the supplied layer must be attached to a Konva stage.

```ts
import LaserMatchView from './laser-match-view'

const view = new LaserMatchView({
  layer,
  x: stage.width() / 2,
  y: stage.height() / 2,
  width: 800,
  height: 480,
  panelColor: '#4b5563',
}, model.graphs())

view.onMatch = (equation, graphIndex) => {
  if (equation === model.graphs()[graphIndex][0]) {
    view.solve(equation)
  } else {
    view.incorrect(equation, graphIndex)
  }
}

view.destroy()
```

`onMatch` reports the selected equation and the selected graph's model index. `solve` blinks twice and disables/fades the matched pair; `incorrect` blinks once and leaves the controls available.
