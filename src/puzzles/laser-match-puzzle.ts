import Konva from 'konva';

import GraphMatchModel from '../graph/graph-match-model';
import LaserMatchView from '../graph/laser-match-view';

import type { StepAnswer } from '../questions/Question'
import Puzzle from './puzzle'

export interface LaserMatchPuzzleOptions {
  layer: Konva.Layer;
  x: number;
  y: number;
  width: number;
  height: number;
  panelColor?: string;
}

class LaserMatchPuzzle implements Puzzle {
  private readonly model: GraphMatchModel;
  private readonly view: LaserMatchView;
  private solvedCount: number = 0;

  public onAnswer?: (answer: StepAnswer) => void;
  public onPuzzleFinished?: (solved: boolean) => void;

  public constructor(
    equationOne: string,
    equationTwo: string,
    equationThree: string,
    options: LaserMatchPuzzleOptions,
  ) {
    this.validateOptions(options);
    this.model = new GraphMatchModel();
    this.model.addGraph(equationOne);
    this.model.addGraph(equationTwo);
    this.model.addGraph(equationThree);
    this.view = new LaserMatchView(options, this.model.graphs());
    this.connectComponents();
  }

  private validateOptions(options: LaserMatchPuzzleOptions): void {
    if (!options.layer.getStage()) {
      throw Error('LaserMatchPuzzle requires a layer attached to a Konva stage.');
    }
    if (!Number.isFinite(options.width) || options.width <= 0) {
      throw Error('LaserMatchPuzzle width must be a positive number.');
    }
    if (!Number.isFinite(options.height) || options.height <= 0) {
      throw Error('LaserMatchPuzzle height must be a positive number.');
    }
  }

  private connectComponents(): void {
    this.view.onMatch = (equation, graph) => {
      const correctAnswer = this.model.graphs().findIndex(entry => entry[0] === equation);

      let isLastStep = (this.solvedCount + 1) === 3;

      this.onAnswer?.({ playerAnswer: `${graph}`, correctAnswer: `${correctAnswer}`, isLastStep });
      if (graph === correctAnswer) {
        this.view.solve(equation);
      } else {
        this.view.incorrect(equation, graph);
      }
    };
    this.view.onSolved = () => {
      this.solvedCount++;
      if (this.solvedCount === 3) {
        this.onPuzzleFinished?.(true);
      }
    };
  }

  public destroy(): void {
    this.onAnswer = undefined;
    this.onPuzzleFinished = undefined;
    this.view.destroy();
    this.view.onMatch = undefined;
    this.view.onSolved = undefined;
  }
}

export default LaserMatchPuzzle;
