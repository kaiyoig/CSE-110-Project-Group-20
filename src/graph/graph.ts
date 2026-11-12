import Konva from 'konva';

interface GraphConfig {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  stepSize?: number;
  xStretch?: number;
  yStretch?: number;
  lineColor?: string;
}

interface LineConfig extends GraphConfig {
  slope: number;
  yOffset: number;
}

interface QuadraticConfig extends GraphConfig {
  a: number;
  b: number;
  c: number;
}

class Graph {
  private static readonly DEFAULT_STEP_SIZE: number = 0.001;
  private static readonly DEFAULT_X_STRETCH: number = 10.0;
  private static readonly DEFAULT_Y_STRETCH: number = 10.0;
  private static readonly DEFAULT_LINE_COLOR: string = "#ddeeee";
  private static readonly GRAPH_COLOR: string = "#aaaa33";
  private static readonly AXIS_BIAS: number = 1.3;
  private static readonly TICK_SIZE: number = 0.15;

  private constructor() { }

  private static evaluate(config: GraphConfig, func: (x: number) => number): Konva.Line {
    const points: number[] = [];
    const stepSize = config.stepSize ?? this.DEFAULT_STEP_SIZE;
    const xStretch = config.xStretch ?? this.DEFAULT_X_STRETCH;
    const yStretch = config.yStretch ?? this.DEFAULT_Y_STRETCH;

    for (let x = config.minX; x <= config.maxX; x += stepSize) {
      const y = func(x);
      if (y < config.minY || y > config.maxY) {
        continue;
      }

      points.push(x * xStretch, -y * yStretch);
    }

    return new Konva.Line({
      points,
      tension: 1.0,
      stroke: config.lineColor ?? this.DEFAULT_LINE_COLOR,
      strokeWidth: 2.0,
    });
  }

  private static addAxes(graph: Konva.Group, config: GraphConfig): void {
    const xStretch = config.xStretch ?? this.DEFAULT_X_STRETCH;
    const yStretch = config.yStretch ?? this.DEFAULT_Y_STRETCH;

    graph.add(new Konva.Line({
      points: [
        0.0,
        -config.minY * yStretch * this.AXIS_BIAS,
        0.0,
        -config.maxY * yStretch * this.AXIS_BIAS,
      ],
      stroke: this.GRAPH_COLOR,
      strokeWidth: 3.0,
    }));
    graph.add(new Konva.Line({
      points: [
        config.minX * xStretch * this.AXIS_BIAS,
        0.0,
        config.maxX * xStretch * this.AXIS_BIAS,
        0.0,
      ],
      stroke: this.GRAPH_COLOR,
      strokeWidth: 3.0,
    }));

    for (let value = Math.ceil(config.minX); value <= Math.floor(config.maxX); value++) {
      if (value == 0) continue;

      const x = value * xStretch;
      graph.add(new Konva.Line({
        points: [x, -yStretch * this.TICK_SIZE, x, yStretch * this.TICK_SIZE],
        stroke: this.GRAPH_COLOR,
        strokeWidth: 2.0,
      }));
      graph.add(new Konva.Text({
        text: `${value}`,
        x: x - 10.0,
        y: yStretch * this.TICK_SIZE,
        width: 20.0,
        align: "center",
        fontSize: 14.0,
        fill: this.GRAPH_COLOR,
      }));
    }

    for (let value = Math.ceil(config.minY); value <= Math.floor(config.maxY); value++) {
      if (value == 0) continue;

      const y = -value * yStretch;
      graph.add(new Konva.Line({
        points: [-xStretch * this.TICK_SIZE, y, xStretch * this.TICK_SIZE, y],
        stroke: this.GRAPH_COLOR,
        strokeWidth: 2.0,
      }));
      graph.add(new Konva.Text({
        text: `${value}`,
        x: xStretch * this.TICK_SIZE,
        y: y - 9.0,
        width: 24.0,
        align: "left",
        fontSize: 14.0,
        fill: this.GRAPH_COLOR,
      }));
    }

    graph.add(new Konva.Text({
      text: "x",
      x: config.maxX * xStretch * this.AXIS_BIAS - 10.0,
      y: 8.0,
      width: 20.0,
      align: "center",
      fontSize: 18.0,
      fontStyle: "bold",
      fill: this.GRAPH_COLOR,
    }));
    graph.add(new Konva.Text({
      text: "y",
      x: 8.0,
      y: -config.maxY * yStretch * this.AXIS_BIAS - 10.0,
      width: 20.0,
      align: "center",
      fontSize: 18.0,
      fontStyle: "bold",
      fill: this.GRAPH_COLOR,
    }));
  }

  private static createGraph(config: GraphConfig, func: (x: number) => number): Konva.Group {
    const graph = new Konva.Group();
    this.addAxes(graph, config);
    graph.add(this.evaluate(config, func));
    return graph;
  }

  static createLine(lineConfig: LineConfig): Konva.Group {
    return this.createGraph(lineConfig, (x: number): number => {
      return x * lineConfig.slope + lineConfig.yOffset;
    });
  }

  static createQuadratic(quadraticConfig: QuadraticConfig): Konva.Group {
    return this.createGraph(quadraticConfig, (x: number): number => {
      return quadraticConfig.a * x * x
        + quadraticConfig.b * x
        + quadraticConfig.c;
    });
  }
}

export default Graph;
