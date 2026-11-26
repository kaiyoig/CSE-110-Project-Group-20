/**
 * How the multistep room reads and writes answers: expressions shown the way
 * a player writes them, keys and keyboard input turned into answers the
 * solver checks, and the solved equation as text.
 */

import type MultistepSolverModel from './multistep-solver-model'
import { formatMath } from '../questions/formatMath'

/** `*` as `·` and `-` as `−`, for reading only. */
export function display(text: string): string {
  return formatMath(text).replace(/-/g, '−')
}

/**
 * An expression to work out, as a player writes it. When it combines x terms,
 * each is written number first, but every sign stays where it was, since
 * working out a double sign is part of the Step: `5 * x - x / -2` (or
 * `x * 5 - x / -2`) reads `5x − x/(−2)` and `-3 * x - 7 * x` reads
 * `−3x − 7x`. Plain arithmetic
 * (`14 - -3`, `21 / 3`) only gets `·` and `−`.
 */
export function displayExpression(expression: string): string {
  if (!/\bx\b/.test(expression)) return display(expression)
  const parts = expression.split(/ ([+-]) /)
  let shown = ''
  for (let i = 0; i < parts.length; i += 2) {
    const term = readXTerm(parts[i], i === 0)
    if (term === null) return display(expression)
    shown += i === 0 ? term : ` ${parts[i - 1] === '-' ? '−' : '+'} ${term}`
  }
  return shown
}

/**
 * One x term written number first (`5 * x` and `x * 5` read `5x`, `x / 2`
 * reads `x/2`). A negative number gets brackets after another sign: `(−3)x`,
 * `x/(−2)`; at the very start it doesn't need them: `−3x`.
 */
function readXTerm(text: string, first: boolean): string | null {
  const numberFirst = /^(-?)(\d+(?:\/\d+)?) \* (-?)x$/.exec(text)
  const xFirst = /^(-?)x \* (-?)(\d+(?:\/\d+)?)$/.exec(text)
  const times = numberFirst
    ? [text, numberFirst[3], numberFirst[1], numberFirst[2]]
    : xFirst
  if (times) {
    const [, xSign, numberSign, number] = times
    const coefficient = number === '1' ? '' : number
    if (numberSign !== '-') return `${xSign ? '−' : ''}${coefficient}x`
    if (first && !xSign) return `−${coefficient}x`
    return `${xSign ? '−' : ''}(−${number})x`
  }
  const divided = /^(-?)x \/ (-?)(\d+)$/.exec(text)
  if (divided) {
    const [, xSign, numberSign, number] = divided
    return `${xSign ? '−' : ''}x/${numberSign ? `(−${number})` : number}`
  }
  return null
}

/** The keypad key a keyboard key stands for, or null if it isn't one. */
export function keyboardKey(key: string): string | null {
  if (/^\d$/.test(key)) return key
  switch (key) {
    case 'x': case 'X': return 'x'
    case '-': case '−': return '-'
    case '/': return '/'
    case 'Backspace': return '⌫'
    case 'Delete': case 'Escape': return 'C'
    case 'Enter': return 'Enter'
    default: return null
  }
}

/**
 * Tidies what the player typed into an answer for the solver to check, or
 * null if it isn't an answer yet: whole numbers and fractions as typed
 * ("-21", "3/4"), and an x term number first ("3x", "-3x", "3/4x", "x"),
 * whether typed "3x" or "x3". The solver decides if it is right.
 */
export function normalizeKeypadAnswer(typed: string): string | null {
  const answer = typed.trim()
  const number = /^-?\d+(\/\d+)?$/
  if (number.test(answer)) return hasZeroDenominator(answer) ? null : answer

  const term = /^(-?)(\d+(?:\/\d+)?)?x(\d+(?:\/\d+)?)?$/.exec(answer)
  if (!term || (term[2] && term[3])) return null
  const coefficient = term[2] ?? term[3] ?? '1'
  if (hasZeroDenominator(coefficient)) return null
  return `${term[1]}${coefficient === '1' ? '' : coefficient}x`
}

function hasZeroDenominator(value: string): boolean {
  return value.includes('/') && Number(value.split('/')[1]) === 0
}

/** The solved equation as the player should read it, e.g. `x = 7` or `x = -3/4`. Empty while unsolved. */
export function answerText(model: MultistepSolverModel): string {
  const sides = [model.getLeftSide(), model.getRightSide()]
  const variable = sides.find(side => side.length === 1 && typeof side[0] !== 'string' && !side[0].constant)
  const constant = sides.find(side => side.length === 1 && typeof side[0] !== 'string' && side[0].constant)
  if (!variable || !constant || typeof variable[0] === 'string' || typeof constant[0] === 'string') return ''
  return `${variable[0].term} = ${constant[0].positive ? '' : '-'}${constant[0].term}`
}
