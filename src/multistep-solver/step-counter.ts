import type MultistepSolverModel from './multistep-solver-model'

/** Search limits, so an unusual equation can never freeze the game. */
const MAX_STEPS = 16
const MAX_STATES = 4000

/**
 * The fewest Steps left to solve `model`'s equation. The model is not changed.
 *
 * A Step is one Answer the player gets right: picking the operation that
 * moves a term (or removes a negative sign), or one piece of arithmetic.
 * Waiting arithmetic always comes next, as the puzzle requires.
 *
 * Players may move terms in any order and some orders take longer, so this
 * is the shortest way on from where the equation is now. Returns 0 when the
 * equation is already solved.
 */
export function stepsLeft(model: MultistepSolverModel): number {
  const start = model.clone()
  const startArithmetic = solveArithmetic(start)
  if (startArithmetic === null) return 0

  // Uniform-cost search: a move costs 1 Step plus the arithmetic it causes.
  const queue: Array<{ state: MultistepSolverModel, steps: number }> = [{ state: start, steps: startArithmetic }]
  const best = new Map<string, number>([[keyOf(start), startArithmetic]])

  while (queue.length > 0) {
    queue.sort((a, b) => a.steps - b.steps)
    const { state, steps } = queue.shift()!
    if (state.isSolved()) return steps
    if (steps >= MAX_STEPS || best.size > MAX_STATES) break

    for (const move of possibleMoves(state)) {
      const scratch = state.clone()
      try {
        move(scratch)
      } catch {
        continue
      }
      const arithmetic = solveArithmetic(scratch)
      if (arithmetic === null) continue

      const total = steps + 1 + arithmetic
      const key = keyOf(scratch)
      if ((best.get(key) ?? Infinity) <= total) continue
      best.set(key, total)
      queue.push({ state: scratch, steps: total })
    }
  }

  // Nothing found within the limits: guess one more move and its arithmetic.
  return startArithmetic + 2
}

/**
 * Every move the player could make: drag any term the view shows (a
 * coefficient such as the 3 in 3x moves as a coefficient, like the view's
 * drag does), or remove a negative sign.
 */
function possibleMoves(model: MultistepSolverModel): Array<(scratch: MultistepSolverModel) => void> {
  const moves: Array<(scratch: MultistepSolverModel) => void> = []
  for (const isLeftSide of [true, false]) {
    for (const { term, modelIndex, isCoefficient } of model.getDisplaySide(isLeftSide)) {
      if (typeof term === 'string') continue
      moves.push(scratch => isLeftSide
        ? scratch.moveLeftTerm(modelIndex, isCoefficient === true)
        : scratch.moveRightTerm(modelIndex, isCoefficient === true))
    }
  }
  moves.push(scratch => scratch.removeNegativeSign(true))
  moves.push(scratch => scratch.removeNegativeSign(false))
  return moves
}

/** Does all waiting arithmetic; returns how many Steps that took, or null if it failed. */
function solveArithmetic(model: MultistepSolverModel): number | null {
  let steps = 0
  try {
    while (model.arithmeticProblems().length > 0) {
      model.solve()
      steps++
      if (steps > MAX_STEPS) return null
    }
  } catch {
    return null
  }
  return steps
}

function keyOf(model: MultistepSolverModel): string {
  return JSON.stringify([model.getLeftSide(), model.getRightSide()])
}
