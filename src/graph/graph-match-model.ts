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

  public addGraph(config: GraphShapeConfig): void;
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

  public graphs(): GraphEntry[] {
    return [...this.graphEntries];
  }

  public get(index: number): Konva.Group {
    const entry = this.graphEntries[index];
    if (!entry) {
      throw new Error(`No graph exists at index ${index}.`);
    }
    return entry[1];
  }
}

export default GraphMatchModel;
