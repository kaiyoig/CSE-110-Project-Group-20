import { describe, it, expect, vi, afterEach } from 'vitest'
import type Konva from 'konva'

vi.mock('konva', () => import('../screens/testing/fakeKonva'))

import BasicMultistepPuzzle, { FINAL_ANSWER_MS } from './basic-multistep-puzzle'
import { FakeLayer, FakeStage, visibleTexts, type FakeNode } from '../screens/testing/fakeKonva'
import type { StepAnswer } from '../questions/Question'

/** x * 3 - 7 = 14: move -7 (add), 14 + 7, move 3 (divide), 21 / 3. */
const EQUATION = 'x * 3 - 7 = 14'

interface Internals {
  controller: {
    getState(): string
    operation(index: number, isLeftSide: boolean): void
  }
  handleKeyDown(event: { key: string, preventDefault(): void }): void
}

function setup(equation = EQUATION) {
  const stage = new FakeStage()
  const layer = new FakeLayer()
  stage.add(layer)
  const puzzle = new BasicMultistepPuzzle(equation, {
    layer: layer as unknown as Konva.Layer,
    x: 720, y: 500,
  })
  const answers: StepAnswer[] = []
  puzzle.onAnswer = answer => answers.push(answer)
  const internals = puzzle as unknown as Internals
  const find = (name: string): FakeNode => {
    const node = layer.findOne(`.${name}`)
    if (!node) throw new Error(`No .${name} on the layer`)
    return node
  }
  const press = (...keys: string[]) => keys.forEach(key => find(`key-${key}`).fire('click'))
  const lit = () => layer.find(node => node.name() === 'light-on').length
  const lights = () => layer.find(node => /^light-(on|off)$/.test(String(node.name()))).length
  return { layer, puzzle, answers, internals, find, press, lit, lights }
}

/** Drops -7 (the last term on the left) and adds 7 to both sides. */
function moveMinusSeven(t: ReturnType<typeof setup>) {
  t.internals.controller.operation(3, true)
  t.find('operation-+').fire('click')
}

/** Solves the whole equation with correct Answers. */
function solve(t: ReturnType<typeof setup>) {
  moveMinusSeven(t)
  t.press('2', '1', 'Enter')
  t.internals.controller.operation(2, true)
  t.find('operation-/').fire('click')
  t.press('7', 'Enter')
}

describe('BasicMultistepPuzzle', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts on Step 1 with a light per Step of par (4), all dark, asking for a term', () => {
    const t = setup()

    expect(t.lights()).toBe(4)
    expect(t.lit()).toBe(0)
    expect(t.find('step-tag').text()).toBe('STEP 1 · PAR 4')
    expect(t.find('step-message').text()).toContain('Drag a term')
    expect(visibleTexts(t.layer)).toEqual(expect.arrayContaining(['ADD', 'SUBTRACT', 'MULTIPLY', 'DIVIDE']))
  })

  it('shows multiplication as · in the equation', () => {
    const t = setup()
    expect(visibleTexts(t.layer)).toContain('·')
  })

  it('only takes an operation after a term is dropped', () => {
    const t = setup()

    t.find('operation-+').fire('click')
    expect(t.answers).toHaveLength(0)

    moveMinusSeven(t)
    expect(t.answers).toEqual([{ playerAnswer: '+', correctAnswer: '+', isLastStep: false, stepPrompt: undefined }])
  })

  it('a wrong operation is reported, lights nothing and keeps waiting for a pick', () => {
    const t = setup()
    t.internals.controller.operation(3, true)

    t.find('operation--').fire('click')

    expect(t.answers[0]).toMatchObject({ playerAnswer: '-', correctAnswer: '+' })
    expect(t.lit()).toBe(0)
    expect(t.internals.controller.getState()).toBe('Operation')
  })

  it('a correct move lights a pin and asks for the arithmetic on the keypad', () => {
    const t = setup()

    moveMinusSeven(t)

    expect(t.lit()).toBe(1)
    expect(t.find('keypad-prompt').text()).toBe('14 + 7 =')
    expect(t.find('step-tag').text()).toBe('STEP 2 · PAR 4')
  })

  it('takes an answer typed on the keypad', () => {
    const t = setup()
    moveMinusSeven(t)

    t.press('2', '1')
    expect(t.find('keypad-answer').text()).toBe('21')
    t.press('Enter')

    expect(t.answers[1]).toMatchObject({ playerAnswer: '21', correctAnswer: '21', stepPrompt: '14 + 7' })
    expect(t.lit()).toBe(2)
  })

  it('a wrong answer flashes TRY AGAIN and lights nothing', () => {
    const t = setup()
    moveMinusSeven(t)

    t.press('2', '0', 'Enter')

    expect(t.answers[1]).toMatchObject({ playerAnswer: '20', correctAnswer: '21' })
    expect(t.find('keypad-answer').text()).toBe('TRY AGAIN')
    expect(t.lit()).toBe(1)
  })

  it('takes the same answer from the keyboard, Enter included', () => {
    const t = setup()
    moveMinusSeven(t)
    const preventDefault = vi.fn()

    for (const key of ['2', '1', 'Enter']) t.internals.handleKeyDown({ key, preventDefault })

    expect(t.answers[1]).toMatchObject({ playerAnswer: '21', correctAnswer: '21' })
    expect(preventDefault).toHaveBeenCalledTimes(3)
  })

  it('ignores the keyboard while a hint covers the puzzle', () => {
    const t = setup()
    moveMinusSeven(t)

    t.puzzle.setInteractionEnabled(false)
    t.internals.handleKeyDown({ key: '2', preventDefault() {} })

    expect(t.find('keypad-answer').text()).toBe('?')
  })

  it('ignores the keypad outside an Arithmetic Step', () => {
    const t = setup()
    t.press('5')
    expect(t.find('keypad-answer').text()).toBe('?')
  })

  it('shows the answer when solved and sends the final Answer after a moment', () => {
    vi.useFakeTimers()
    const t = setup()
    const finished = vi.fn()
    t.puzzle.onPuzzleFinished = finished

    solve(t)

    expect(finished).toHaveBeenCalledExactlyOnceWith(true)
    expect(t.lit()).toBe(4)
    expect(t.find('solved-panel').visible()).toBe(true)
    expect(t.find('solved-answer').text()).toBe('x = 7')
    expect(t.find('keypad-answer').text()).toBe('x = 7')
    expect(t.answers).toHaveLength(3) // the Room-solving Answer waits

    vi.advanceTimersByTime(FINAL_ANSWER_MS)
    expect(t.answers).toHaveLength(4)
    expect(t.answers[3]).toMatchObject({ playerAnswer: '7', isLastStep: true })
  })

  it('"Back to map" sends the final Answer at once, and only once', () => {
    vi.useFakeTimers()
    const t = setup()
    solve(t)

    t.find('back-to-map').fire('click')
    vi.advanceTimersByTime(FINAL_ANSWER_MS)

    expect(t.answers).toHaveLength(4)
    expect(t.answers[3].isLastStep).toBe(true)
  })

  it('sendPendingAnswer (the Room\'s Exit) sends the final Answer at once, and only once', () => {
    vi.useFakeTimers()
    const t = setup()
    t.puzzle.sendPendingAnswer() // nothing held yet
    expect(t.answers).toHaveLength(0)
    solve(t)

    t.puzzle.sendPendingAnswer()
    t.find('back-to-map').fire('click')
    vi.advanceTimersByTime(FINAL_ANSWER_MS)

    expect(t.answers).toHaveLength(4)
    expect(t.answers[3]).toMatchObject({ playerAnswer: '7', isLastStep: true })
  })

  it('says when the answer has an x, and takes it typed as -10x', () => {
    // Moving x * 7 leaves x * -3 - x * 7 = 10: the two x terms combine to -x * 10.
    const t = setup('x * -3 = 10 + x * 7')
    t.internals.controller.operation(1, false)
    t.find('operation--').fire('click')

    expect(t.find('keypad-prompt').text()).toBe('−3x − 7x =')
    expect(t.find('step-message').text()).toBe('Combine the x terms: −3x − 7x')

    t.press('-', '1', '0', 'x', 'Enter')
    expect(t.answers[1]).toMatchObject({ playerAnswer: '-10x', correctAnswer: '-10 * x', isMultistepArithmetic: true })
  })

  it('solves -x = -9 in one Step: drop the minus sign and multiply', () => {
    vi.useFakeTimers()
    const t = setup('-x = -9')
    expect(t.lights()).toBe(1)
    expect(t.find('step-message').text()).toBe('Drag the − in front of x into the socket')

    ;(t.internals.controller as unknown as { removeNegativeSign(left: boolean): void }).removeNegativeSign(true)
    t.find('operation-*').fire('click')

    expect(t.find('solved-answer').text()).toBe('x = 9')
    expect(t.lit()).toBe(1)
    expect(visibleTexts(t.layer)).toContain('Solved in 1 step, right on par!')
  })

  it('a longer way round keeps the lights at par and shows the extra Steps as +1', () => {
    const t = setup()
    // Move the 3 first (5 Steps) instead of the -7 (par 4).
    t.internals.controller.operation(2, true)
    t.find('operation-/').fire('click')
    t.press('-', '7', '/', '3', 'Enter')
    t.press('1', '4', '/', '3', 'Enter')
    expect(t.lit()).toBe(3)
    t.internals.controller.operation(1, true)
    t.find('operation-+').fire('click')
    expect(t.lit()).toBe(4)
    expect(t.lights()).toBe(4)
    expect(t.find('step-tag').text()).toBe('STEP 5 · PAR 4')

    t.press('7', 'Enter')

    expect(t.lights()).toBe(4)
    expect(t.find('keypad-progress').text()).toBe('+1')
    expect(t.find('solved-answer').text()).toBe('x = 7')
    expect(visibleTexts(t.layer)).toContain('Solved in 5 steps (par 4)')
  })

  it('checks arithmetic the way the solver does: simplest form only', () => {
    const t = setup()
    // Moving the 3 first leaves -7 / 3 to work out.
    t.internals.controller.operation(2, true)
    t.find('operation-/').fire('click')
    expect(t.find('operations-hint').text()).toContain('simplest fraction')

    t.press('-', '1', '4', '/', '6', 'Enter')
    expect(t.answers[1]).toMatchObject({ playerAnswer: '-14/6', isMultistepArithmetic: true })
    expect(t.lit()).toBe(1)

    t.press('-', '7', '/', '3', 'Enter')
    expect(t.lit()).toBe(2)
  })

  it('operation Steps are not marked as arithmetic', () => {
    const t = setup()
    moveMinusSeven(t)
    expect(t.answers[0].isMultistepArithmetic).toBeUndefined()
  })

  it('solving on par says so', () => {
    vi.useFakeTimers()
    const t = setup()
    solve(t)
    expect(visibleTexts(t.layer)).toContain('Solved in 4 steps, right on par!')
    expect(t.find('keypad-progress').text()).toBe('4/4')
  })

  it('destroy removes everything it drew', () => {
    const t = setup()
    t.puzzle.destroy()
    expect(t.layer.getChildren().filter(node => !node.destroyed)).toHaveLength(0)
  })

  it('rejects a layer that is not on a stage', () => {
    const layer = new FakeLayer() as unknown as Konva.Layer
    expect(() => new BasicMultistepPuzzle(EQUATION, { layer, x: 0, y: 0 })).toThrow()
  })
})



