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

/** Combines a styled Konva input rectangle with an internal HTML text input. */
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

  /** Creates a hidden text input overlay. @param options Input size, position, and color options. */
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
    // Positioning is calculated from getBoundingClientRect(), which uses
    // viewport coordinates. Fixed positioning keeps the HTML overlay in that
    // same coordinate system and prevents document/body offsets from shifting
    // it away from the Konva rectangle.
    this.input.style.position = 'fixed'
    this.input.style.boxSizing = 'border-box'
    this.input.style.border = 'none'
    this.input.style.outline = 'none'
    this.input.style.padding = '0 6px'
    this.input.style.margin = '0'
    this.input.style.background = 'transparent'
    this.input.style.color = options.foregroundColor
    const inputWidth = Math.max(1, options.width - TextInput.OUTLINE_WIDTH * 2)
    const inputHeight = Math.max(1, options.height - TextInput.OUTLINE_WIDTH * 2)
    this.setTextMetrics(inputHeight)
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

  /** Returns the current input text. @returns Current text. */
  public text(): string {
    return this.input.value
  }

  /** Clears the input text. */
  public clear(): void {
    this.input.value = ''
  }

  /** Changes the input text color. @param color New text color. */
  public textColor(color: string): void {
    this.input.style.color = color
  }

  /** Changes the placeholder color. @param color New placeholder color. */
  public ghostTextColor(color: string): void {
    const style = document.getElementById(this.ghostTextClass)
    if (style) style.textContent = `.${this.ghostTextClass}::placeholder { color: ${color}; }`
  }

  /** Changes the Konva background color. @param color New fill color. */
  public backgroundColor(color: string): void {
    this.background.fill(color)
  }

  /** Changes the input outline color. @param color New outline color. */
  public outlineColor(color: string): void {
    this.background.stroke(color)
  }

  /** Shows the input centered at the supplied position. @param x Center x. @param y Center y. @returns This input. */
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

  /** Hides the input and disables interaction. @returns This input. */
  public hide(): this {
    this.visible(false)
    this.listening(false)
    this.input.style.display = 'none'
    this.input.blur()
    return this
  }

  /** Disables typing and focus without changing visibility. */
  public disable(): void {
    this.enabled = false
    this.input.disabled = true
    this.input.style.display = 'none'
  }

  /** Enables typing and focus. */
  public enable(): void {
    this.enabled = true
    this.input.disabled = false
    if (this.visible()) this.input.style.display = 'block'
  }

  /** Removes the HTML input and its placeholder style, then destroys the Konva group. @returns This input. */
  public override destroy(): this {
    this.hide() // hidden first, so a blur during removal doesn't submit
    this.input.remove()
    document.getElementById(this.ghostTextClass)?.remove()
    return super.destroy()
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
      const rectangle = this.background.getClientRect()
      const inputWidth = Math.max(1, rectangle.width - inset * 2)
      const inputHeight = Math.max(1, rectangle.height - inset * 2)
      this.input.style.left = `${rectangle.x + inset}px`
      this.input.style.top = `${rectangle.y + inset}px`
      this.input.style.width = `${inputWidth}px`
      this.input.style.height = `${inputHeight}px`
      this.setTextMetrics(inputHeight)
      return
    }

    const contentRect = stage.getContent().getBoundingClientRect()
    const scaleX = contentRect.width / stage.width()
    const scaleY = contentRect.height / stage.height()
    const rectangle = this.background.getClientRect({ relativeTo: stage })
    const inputWidth = Math.max(1, rectangle.width - inset * 2) * scaleX
    const inputHeight = Math.max(1, rectangle.height - inset * 2) * scaleY
    this.input.style.left = `${contentRect.left + (rectangle.x + inset) * scaleX}px`
    this.input.style.top = `${contentRect.top + (rectangle.y + inset) * scaleY}px`
    this.input.style.width = `${inputWidth}px`
    this.input.style.height = `${inputHeight}px`
    this.setTextMetrics(inputHeight)
  }

  private setTextMetrics(inputHeight: number): void {
    const fontSize = Math.max(1, Math.floor(inputHeight * 0.5))
    const verticalPadding = Math.max(0, (inputHeight - fontSize) / 2)
    this.input.style.padding = `${verticalPadding}px 6px`
    this.input.style.fontSize = `${fontSize}px`
    this.input.style.lineHeight = `${fontSize}px`
  }
}

export default TextInput
