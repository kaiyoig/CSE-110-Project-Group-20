import Konva from 'konva';

import LaserMatchPuzzle from '../puzzles/laser-match-puzzle';

const stage = new Konva.Stage({
  container: 'container',
  width: window.innerWidth,
  height: window.innerHeight,
});

const layer = new Konva.Layer();
stage.add(layer);

const puzzle = new LaserMatchPuzzle(
  'y = 1 * x + 1',
  'y = -1 * x * x + 0 * x + 2',
  'y = -2 * x - 1',
  {
    layer,
    x: stage.width() / 2,
    y: stage.height() / 2,
    width: 800,
    height: 480,
    panelColor: '#4b5563',
  },
);

puzzle.onAnswer = answer => {
  console.log(`Selected graph ${answer.playerAnswer}; expected ${answer.correctAnswer}. Last step? ${answer.isLastStep}`);
};

puzzle.onPuzzleFinished = solved => {
  console.log(solved ? 'Puzzle solved!' : 'Puzzle failed.');
};
