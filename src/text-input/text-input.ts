import Konva from 'konva'

export interface TextInputOptions {
  layer: Konva.Layer
  x: number
  y: number
  width: number
  height: number
  backgroundColor: string
  foregroundColor: string
  ghostText?: string
  ghostTextColor: string
}

class TextInput extends Konva.Group {
  private static readonly OUTLINE_WIDTH = 2
  private static nextInputId = 0

  private readonly layer: Konva.Layer
  private readonly input: HTMLInputElement
  private readonly background: Konva.Rect
  private readonly ghostTextClass: string
  private enabled = true

  public onTextEntered?: (text: string) => void
  public onTextFocused?: () => void

  constructor(options: TextInputOptions) {
    if (!Number.isFinite(options.width) || options.width <= 0) {
      throw Error('TextInput width must be a positive number.')
    }
    if (!Number.isFinite(options.height) || options.height <= 0) {
      throw Error('TextInput height must be a positive number.')
    }

    super({
      x: options.x - options.width / 2,
      y: options.y - options.height / 2,
      width: options.width,
      height: options.height,
      visible: false,
      listening: false,
    })

    this.layer = options.layer
    this.background = new Konva.Rect({
      width: options.width,
      height: options.height,
      fill: options.backgroundColor,
      strokeWidth: TextInput.OUTLINE_WIDTH,
      cornerRadius: 10.0
    })
    this.add(this.background)
    this.layer.add(this)

    this.ghostTextClass = `text-input-ghost-${TextInput.nextInputId++}`
    this.input = document.createElement('input')
    this.input.type = 'text'
    this.input.className = this.ghostTextClass
    this.input.placeholder = options.ghostText ?? ''
    this.input.autocomplete = 'off'
    this.input.style.position = 'absolute'
    this.input.style.boxSizing = 'border-box'
    this.input.style.border = 'none'
    this.input.style.outline = 'none'
    this.input.style.padding = '0 6px'
    this.input.style.margin = '0'
    this.input.style.background = 'transparent'
    this.input.style.color = options.foregroundColor
    const inputWidth = Math.max(1, options.width - TextInput.OUTLINE_WIDTH * 2)
    const inputHeight = Math.max(1, options.height - TextInput.OUTLINE_WIDTH * 2)
    this.input.style.fontSize = `${Math.max(1, Math.floor(inputHeight * 0.5))}px`
    this.input.style.lineHeight = `${inputHeight}px`
    this.input.style.height = `${inputHeight}px`
    this.input.style.width = `${inputWidth}px`
    this.input.style.display = 'none'
    document.body.append(this.input)

    this.addGhostTextStyle(options.ghostTextColor)

    this.input.addEventListener('focus', () => {
      this.onTextFocused?.()
    })
    this.input.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return
      event.preventDefault()
      this.submitText()
    })
    this.input.addEventListener('blur', () => {
      if (this.visible()) this.submitText()
    })
  }

  public text(): string {
    return this.input.value
  }

  public textColor(color: string): void {
    this.input.style.color = color
  }

  public ghostTextColor(color: string): void {
    const style = document.getElementById(this.ghostTextClass)
    if (style) style.textContent = `.${this.ghostTextClass}::placeholder { color: ${color}; }`
  }

  public backgroundColor(color: string): void {
    this.background.fill(color)
  }

  public outlineColor(color: string): void {
    this.background.stroke(color)
  }

  public show(x: number, y: number): this
  public show(): this
  public show(x?: number, y?: number): this {
    if (x !== undefined && y !== undefined) {
      this.position({
        x: x - this.width() / 2,
        y: y - this.height() / 2,
      })
    }

    this.visible(true)
    this.listening(true)
    this.input.style.display = this.enabled ? 'block' : 'none'
    this.updateInputPosition()
    return this
  }

  public hide(): this {
    this.visible(false)
    this.listening(false)
    this.input.style.display = 'none'
    this.input.blur()
    return this
  }

  public disable(): void {
    this.enabled = false
    this.input.disabled = true
    this.input.style.display = 'none'
  }

  public enable(): void {
    this.enabled = true
    this.input.disabled = false
    if (this.visible()) this.input.style.display = 'block'
  }

  private submitText(): void {
    this.onTextEntered?.(this.text())
  }

  private addGhostTextStyle(color: string): void {
    const style = document.createElement('style')
    style.id = this.ghostTextClass
    style.textContent = `.${this.ghostTextClass}::placeholder { color: ${color}; }`
    document.head.append(style)
  }

  private updateInputPosition(): void {
    const stage = this.layer.getStage()
    const inset = TextInput.OUTLINE_WIDTH

    if (!stage) {
      const absolutePosition = this.getAbsolutePosition()
      const inputWidth = Math.max(1, this.width() - inset * 2)
      const inputHeight = Math.max(1, this.height() - inset * 2)
      this.input.style.left = `${absolutePosition.x + inset}px`
      this.input.style.top = `${absolutePosition.y + inset}px`
      this.input.style.width = `${inputWidth}px`
      this.input.style.height = `${inputHeight}px`
      this.input.style.fontSize = `${Math.max(1, Math.floor(inputHeight * 0.5))}px`
      this.input.style.lineHeight = `${inputHeight}px`
      return
    }

    const contentRect = stage.getContent().getBoundingClientRect()
    const scaleX = contentRect.width / stage.width()
    const scaleY = contentRect.height / stage.height()
    const absolutePosition = this.getAbsolutePosition(stage)
    const rectangleWidth = this.width() * scaleX
    const rectangleHeight = this.height() * scaleY
    const inputWidth = Math.max(1, rectangleWidth - inset * 2)
    const inputHeight = Math.max(1, rectangleHeight - inset * 2)
    this.input.style.left = `${contentRect.left + absolutePosition.x * scaleX + inset}px`
    this.input.style.top = `${contentRect.top + absolutePosition.y * scaleY + inset}px`
    this.input.style.width = `${inputWidth}px`
    this.input.style.height = `${inputHeight}px`
    this.input.style.fontSize = `${Math.max(1, Math.floor(inputHeight * 0.5))}px`
    this.input.style.lineHeight = `${inputHeight}px`
  }
}

export default TextInput
