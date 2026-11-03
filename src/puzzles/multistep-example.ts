import Konva from 'konva'

import BasicMultistepPuzzle from './basic-multistep-puzzle'

const stage = new Konva.Stage({
  container: 'container',
  width: 1920,
  height: 1080,
})

const layer = new Konva.Layer()
stage.add(layer)

const puzzle = new BasicMultistepPuzzle('x * 5 + 3 = 8', {
  layer,
  x: 1920 / 2 - 350,
  y: 1080 / 2 - 200,
  width: 700,
  height: 400,
  spacing: 24,
  blockSize: 32,
  panelColor: '#4b5563',
})

puzzle.onPuzzleFinished = solved => {
  console.log(solved ? 'Puzzle solved!' : 'Puzzle failed.')
}
