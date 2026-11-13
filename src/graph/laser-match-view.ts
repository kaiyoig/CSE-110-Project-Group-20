import Konva from 'konva';

import RadioButton from './radio-button';
import type { GraphEntry } from './graph-match-model';

export interface LaserMatchViewOptions {
  layer: Konva.Layer;
  x: number;
  y: number;
  width: number;
  height: number;
  panelColor?: string;
}

interface EquationRow {
  equation: string;
  text: Konva.Text;
  radio: RadioButton;
  matched: boolean;
}

interface GraphRow {
  index: number;
  graph: Konva.Group;
  radio: RadioButton;
  matched: boolean;
}

class LaserMatchView {
  private readonly options: LaserMatchViewOptions;
  private readonly root: Konva.Group;
  private readonly equationRows: EquationRow[] = [];
  private readonly graphRows: GraphRow[] = [];
  private selectedEquation?: EquationRow;
  private selectedGraph?: GraphRow;
  private pendingMatch?: { equation: string; graph: number };
  private laser?: Konva.Line;

  public onMatch?: (equation: string, graph: number) => void;
  public onSolved?: (equation: string) => void;

  public constructor(options: LaserMatchViewOptions, entries: GraphEntry[]) {
    this.options = options;
    this.root = new Konva.Group({
      x: options.x - options.width / 2,
      y: options.y - options.height / 2,
    });
    options.layer.add(this.root);
    this.root.add(new Konva.Rect({
      width: options.width,
      height: options.height,
      fill: options.panelColor ?? '#4b5563',
      cornerRadius: 8,
    }));
    this.createRows(entries);
  }

  private createRows(entries: GraphEntry[]): void {
    const rowHeight = this.options.height / Math.max(entries.length, 1);
    const graphEntries = [...entries].sort(() => Math.random() - 0.5);
    entries.forEach(([equation], index) => {
      const y = rowHeight * index + rowHeight / 2;
      const text = new Konva.Text({
        text: equation,
        x: 24,
        y: y - 16,
        width: this.options.width / 2 - 44,
        fontSize: 28,
        fill: '#ffffff',
        align: 'left',
      });
      const radio = new RadioButton(28, '#ffffff', '#4b5563', '#ffffff');
      radio.position({ x: this.options.width * 0.45, y: y - 14 });
      const row = { equation, text, radio, matched: false };
      radio.onClick = () => this.selectEquation(row);
      this.equationRows.push(row);
      this.root.add(text);
      this.root.add(radio);
    });

    graphEntries.forEach(([_, graph], index) => {
      const y = rowHeight * index + rowHeight / 2;
      const radio = new RadioButton(28, '#ffffff', '#4b5563', '#ffffff');
      radio.position({ x: this.options.width * 0.55, y: y - 14 });
      graph.scale({ x: 0.9, y: 0.9 });
      graph.position({ x: this.options.width * 0.85, y });
      graph.on('click tap', () => this.selectGraph(this.graphRows[index]));
      const row = {
        index: entries.findIndex(entry => entry[1] === graph),
        graph,
        radio,
        matched: false,
      };
      graph.setAttr('graphIndex', row.index);
      radio.onClick = () => this.selectGraph(row);
      this.graphRows.push(row);
      this.root.add(radio);
      this.root.add(graph);
    });
  }

  private selectEquation(row: EquationRow): void {
    if (row.matched) return;
    this.selectedEquation?.radio.clear();
    this.selectedEquation = row;
    this.tryMatch();
  }

  private selectGraph(row: GraphRow): void {
    if (row.matched) return;
    this.selectedGraph?.radio.clear();
    this.selectedGraph = row;
    this.tryMatch();
  }

  private tryMatch(): void {
    if (!this.selectedEquation || !this.selectedGraph) return;
    const equation = this.selectedEquation;
    const graph = this.selectedGraph;
    this.selectedEquation = undefined;
    this.selectedGraph = undefined;
    this.pendingMatch = { equation: equation.equation, graph: graph.index };
    this.onMatch?.(equation.equation, graph.index);
  }

  private drawLaser(equation: string, graph: number): Konva.Line | undefined {
    const equationRow = this.equationRows.find(row => row.equation === equation);
    const graphRow = this.graphRows.find(row => row.index === graph);
    if (!equationRow || !graphRow) return undefined;
    const start = equationRow.radio.getAbsolutePosition();
    const end = graphRow.radio.getAbsolutePosition();
    this.laser?.destroy();
    this.laser = new Konva.Line({
      points: [start.x + 14, start.y + 14, end.x + 14, end.y + 14],
      stroke: '#ff0000',
      strokeWidth: 5,
      opacity: 0,
    });
    this.options.layer.add(this.laser);
    return this.laser;
  }

  public solve(equation: string): void {
    const target = this.pendingMatch?.equation === equation
      ? this.pendingMatch.graph
      : this.graphRows.find(row => !row.matched)?.index;
    if (target === undefined) return;
    const laser = this.drawLaser(equation, target);
    if (!laser) return;
    laser.to({
      opacity: 1, duration: 0.12, onFinish: () => {
        laser.to({
          opacity: 0, duration: 0.12, onFinish: () => {
            laser.to({
              opacity: 1, duration: 0.12, onFinish: () => {
                laser.to({ opacity: 0, duration: 0.12, onFinish: () => this.finishMatch(equation, target) });
              }
            });
          }
        });
      }
    });
  }

  public incorrect(equation: string, graph: number): void {
    const laser = this.drawLaser(equation, graph);
    if (!laser) return;
    laser.to({
      opacity: 1, duration: 0.12, onFinish: () => {
        laser.to({
          opacity: 0, duration: 0.12, onFinish: () => {
            this.clearSelection(equation, graph);
            laser.destroy();
          }
        });
      }
    });
  }

  private finishMatch(equation: string, graph: number): void {
    const equationRow = this.equationRows.find(row => row.equation === equation);
    const graphRow = this.graphRows.find(row => row.index === graph);
    if (!equationRow || !graphRow) return;
    equationRow.matched = true;
    graphRow.matched = true;
    equationRow.radio.disable();
    graphRow.radio.disable();
    equationRow.text.opacity(0.45);
    graphRow.graph.opacity(0.45);
    graphRow.radio.opacity(0.45);
    equationRow.radio.opacity(0.45);
    this.onSolved?.(equation);
    this.laser?.destroy();
  }

  private clearSelection(equation: string, graph: number): void {
    this.equationRows.find(row => row.equation === equation)?.radio.clear();
    this.graphRows.find(row => row.index === graph)?.radio.clear();
  }

  public destroy(): void {
    this.onMatch = undefined;
    this.onSolved = undefined;
    this.laser?.destroy();
    this.root.destroy();
  }
}

export default LaserMatchView;
