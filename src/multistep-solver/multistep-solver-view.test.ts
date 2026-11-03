import { describe, expect, it, vi } from 'vitest'

vi.mock('konva', () => {
  class FakeNode {
    attrs: Record<string, any>
    children: FakeNode[] = []
    parent: FakeNode | null = null
    listeners: Record<string, Function[]> = {}

    constructor(config: Record<string, any> = {}) {
      this.attrs = { ...config }
    }

    add(...children: FakeNode[]) {
      for (const child of children) {
        child.parent = this
        this.children.push(child)
      }
      return this
    }

    on(event: string, callback: Function) {
      this.listeners[event] ??= []
      this.listeners[event].push(callback)
      return this
    }

    off(event?: string) {
      if (!event) this.listeners = {}
      else if (event.startsWith('.')) {
        for (const key of Object.keys(this.listeners)) {
          if (key.endsWith(event)) delete this.listeners[key]
        }
      } else delete this.listeners[event]
      return this
    }

    clone() {
      return new (this.constructor as any)(this.attrs)
    }

    destroy() {
      if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this)
    }

    setAttr(name: string, value: any) {
      this.attrs[name] = value
    }

    getAttr(name: string) {
      return this.attrs[name]
    }

    position(value?: { x: number, y: number }) {
      if (value) {
        this.attrs.x = value.x
        this.attrs.y = value.y
      }
      return { x: this.attrs.x ?? 0, y: this.attrs.y ?? 0 }
    }

    x(value?: number) {
      if (value !== undefined) this.attrs.x = value
      return this.attrs.x ?? 0
    }

    y(value?: number) {
      if (value !== undefined) this.attrs.y = value
      return this.attrs.y ?? 0
    }

    width(value?: number) {
      if (value !== undefined) this.attrs.width = value
      return this.attrs.width ?? 0
    }

    height(value?: number) {
      if (value !== undefined) this.attrs.height = value
      return this.attrs.height ?? 0
    }

    visible(value?: boolean) {
      if (value !== undefined) this.attrs.visible = value
      return this.attrs.visible ?? true
    }

    listening(value?: boolean) {
      if (value !== undefined) this.attrs.listening = value
      return this.attrs.listening ?? true
    }

    fill(value?: string) {
      if (value !== undefined) this.attrs.fill = value
      return this.attrs.fill
    }

    text(value?: string) {
      if (value !== undefined) this.attrs.text = value
      return this.attrs.text
    }

    findOne(selector: string): FakeNode | undefined {
      if (selector.startsWith('.')) {
        const name = selector.slice(1)
        return this.children.find(child => child.attrs.name === name)
      }
      return undefined
    }

    getClientRect() {
      return {
        x: this.attrs.x ?? 0,
        y: this.attrs.y ?? 0,
        width: this.attrs.width ?? 0,
        height: this.attrs.height ?? 0,
      }
    }
  }

  class FakeGroup extends FakeNode {}
  class FakeRect extends FakeNode {}
  class FakeText extends FakeNode {}
  class FakeLayer extends FakeGroup {}
  class FakeStage extends FakeGroup {}

  return {
    default: {
      Group: FakeGroup,
      Rect: FakeRect,
      Text: FakeText,
      Layer: FakeLayer,
      Stage: FakeStage,
    },
  }
})

import Konva from 'konva'
import MultistepSolverModel from './multistep-solver-model'
import MultistepSolverView from './multistep-solver-view'
import { constantTerm, variableTerm } from './types'

describe('MultistepSolverView', () => {
  const setup = () => {
    const stage = new Konva.Stage({ width: 600, height: 400 })
    const layer = new Konva.Layer()
    stage.add(layer)
    const view = new MultistepSolverView(stage, layer, {
      panelWidth: 500,
      panelHeight: 300,
      blockSize: 32,
    })
    return { stage, layer, view }
  }

  it('renders synthetic additive operator blocks without changing model terms', () => {
    const { layer, view } = setup()
    const model = new MultistepSolverModel()
    model.addLeft(variableTerm('x', true))
    model.addLeft('*')
    model.addLeft(constantTerm(5))
    model.addLeft(constantTerm(3))
    model.addRight(constantTerm(8))

    view.update(model)

    const internal = view as any
    expect(model.getLeftSide()).toHaveLength(4)
    expect(internal.leftSide).toHaveLength(5)
    expect(internal.leftSide[3].getAttr('term')).toBe('+')
    expect(internal.leftSide[3].getAttr('modelIndex')).toBe(3)
    expect(internal.panel.width()).toBe(500)
    expect(internal.panel.height()).toBe(300)
    expect(layer.children).toContain(internal.view)
  })

  it('updates reused blocks into a green draggable negative-sign palette block', () => {
    const { view } = setup()
    const model = new MultistepSolverModel()
    model.addLeft(variableTerm('x', true))
    model.addLeft('*')
    model.addLeft(constantTerm(5))
    model.addRight(constantTerm(5))
    view.update(model)

    model.getLeftSide()[0] = variableTerm('x', false)
    view.update(model)

    const negativeBlock = (view as any).leftSide[0]
    expect(negativeBlock.getAttr('negativeSign')).toBe(true)
    expect(negativeBlock.getAttr('paletteBlock')).toBe(true)
    expect(negativeBlock.findOne('.background').fill()).toBe('#4ade80')
    expect(negativeBlock.listeners['mousedown.palette touchstart.palette']).toHaveLength(1)
  })

  it('renders negative additive terms with a minus block', () => {
    const { view } = setup()
    const model = new MultistepSolverModel()
    model.addLeft(variableTerm('x', true))
    model.addLeft('*')
    model.addLeft(constantTerm(5))
    model.addLeft(constantTerm(3))
    model.getLeftSide()[3] = { term: '3', positive: false, constant: true }
    model.addRight(constantTerm(8))

    view.update(model)

    const internal = view as any
    expect(internal.leftSide[3].getAttr('term')).toBe('-')
    expect(internal.leftSide[3].getAttr('negativeSign')).not.toBe(true)
  })
})
