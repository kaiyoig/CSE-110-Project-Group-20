import Konva from 'konva';

import Graph, {
  equationFromConfig,
  parseEquation,
  type GraphConfig,
  type LineConfig,
  type QuadraticConfig,
} from './graph';

export type GraphEntry = [equation: string, graph: Konva.Group];
export type GraphShapeConfig = LineConfig | QuadraticConfig;

class GraphMatchModel {
  private readonly graphEntries: GraphEntry[] = [];

  /** Adds a graph configuration and derives its equation text. */
  public addGraph(config: GraphShapeConfig): void;
  /** Parses and adds an equation using the default graph bounds. */
  public addGraph(equation: string): void;
  public addGraph(configOrEquation: GraphShapeConfig | string): void {
    const config: GraphConfig = typeof configOrEquation === 'string'
      ? parseEquation(configOrEquation)
      : configOrEquation;
    const equation = typeof configOrEquation === 'string'
      ? configOrEquation
      : equationFromConfig(config);
    const graph = config.slope !== undefined && config.yOffset !== undefined
      ? Graph.createLine(config as LineConfig)
      : Graph.createQuadratic(config as QuadraticConfig);
    this.graphEntries.push([equation, graph]);
  }

  /** Returns the model entries as `[equation, graph]` tuples. */
  public graphs(): GraphEntry[] {
    return [...this.graphEntries];
  }

  /** Returns the graph at an internal model index. */
  public get(index: number): Konva.Group {
    const entry = this.graphEntries[index];
    if (!entry) {
      throw new Error(`No graph exists at index ${index}.`);
    }
    return entry[1];
  }
}

export default GraphMatchModel;
