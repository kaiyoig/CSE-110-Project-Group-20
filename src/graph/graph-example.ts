import Konva from 'konva';

import Graph from './graph';

const stage = new Konva.Stage({
  container: 'container',
  width: 1920,
  height: 1080,
});

const layer = new Konva.Layer();
stage.add(layer);

let line = Graph.createLine({
  minX: -2.0,
  minY: 0.0,
  maxX: 4.0,
  maxY: 4.0,
  xStretch: 20.0,
  yStretch: 20.0,
  slope: 1.0,
  yOffset: 1.0,
  lineColor: "#2f80ed",
});

line.x(200);
line.y(200);

let quadratic = Graph.createQuadratic({
  minX: -4.0,
  minY: -4.0,
  maxX: 4.0,
  maxY: 4.0,
  a: -1.0,
  b: 2.0,
  c: 1.0,
  stepSize: 0.001,
  xStretch: 20.0,
  yStretch: 20.0,
  lineColor: "#eb5757",
});

quadratic.x(700);
quadratic.y(200);

layer.add(line);
layer.add(quadratic);
