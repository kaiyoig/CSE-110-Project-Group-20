/**
 * A small fake of the Konva node tree for screen tests, used with
 * `vi.mock("konva", () => import("./testing/fakeKonva"))`. No canvas: nodes
 * keep their attrs, children and event handlers so tests can assert on them
 * and fire click handlers.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

type Handler = (event: any) => void;

const DEFAULTS: Record<string, unknown> = {
  x: 0, y: 0, width: 0, height: 0, visible: true, listening: true, opacity: 1, text: "",
};

const ATTRS = [
  "x", "y", "width", "height", "visible", "listening", "fill", "stroke", "strokeWidth",
  "text", "opacity", "fontSize", "fontStyle", "fontFamily", "align", "verticalAlign",
  "cornerRadius", "name", "clipX", "clipY", "clipWidth", "clipHeight", "radius", "points", "data",
];

export class FakeNode {
  [key: string]: any;
  attrs: Record<string, any>;
  children: FakeNode[] = [];
  parent: FakeNode | null = null;
  handlers = new Map<string, Handler[]>();
  destroyed = false;

  constructor(config: Record<string, any> = {}) {
    this.attrs = { ...config };
  }

  add(...children: FakeNode[]): this {
    for (const child of children) {
      child.remove();
      child.parent = this;
      this.children.push(child);
    }
    return this;
  }

  remove(): this {
    if (this.parent) {
      this.parent.children = this.parent.children.filter((c) => c !== this);
      this.parent = null;
    }
    return this;
  }

  destroy(): this {
    this.destroyChildren();
    this.remove();
    this.destroyed = true;
    return this;
  }

  destroyChildren(): this {
    [...this.children].forEach((child) => child.destroy());
    return this;
  }

  getChildren(): FakeNode[] {
    return this.children;
  }

  getParent(): FakeNode | null {
    return this.parent;
  }

  getLayer(): FakeNode | null {
    let node: FakeNode | null = this;
    while (node && !(node instanceof FakeLayer)) node = node.parent;
    return node;
  }

  getStage(): FakeNode | null {
    let node: FakeNode | null = this;
    while (node && !(node instanceof FakeStage)) node = node.parent;
    return node;
  }

  setAttr(name: string, value: any): this {
    this.attrs[name] = value;
    return this;
  }

  getAttr(name: string): any {
    return this.attrs[name];
  }

  position(value?: { x: number; y: number }): any {
    if (value) {
      this.attrs.x = value.x;
      this.attrs.y = value.y;
      return this;
    }
    return { x: this.attrs.x ?? 0, y: this.attrs.y ?? 0 };
  }

  scale(value?: { x: number; y: number }): any {
    if (value) {
      this.attrs.scaleX = value.x;
      this.attrs.scaleY = value.y;
      return this;
    }
    return { x: this.attrs.scaleX ?? 1, y: this.attrs.scaleY ?? 1 };
  }

  show(): this {
    this.attrs.visible = true;
    return this;
  }

  hide(): this {
    this.attrs.visible = false;
    return this;
  }

  /** Visible itself and every ancestor visible. */
  isVisible(): boolean {
    let node: FakeNode | null = this;
    while (node) {
      if (node.attrs.visible === false) return false;
      node = node.parent;
    }
    return true;
  }

  moveToTop(): this {
    if (this.parent) {
      const parent = this.parent;
      parent.children = [...parent.children.filter((c) => c !== this), this];
    }
    return this;
  }

  batchDraw(): this {
    return this;
  }

  draw(): this {
    return this;
  }

  on(events: string, handler: Handler): this {
    for (const key of events.split(" ").filter(Boolean)) {
      const list = this.handlers.get(key) ?? [];
      list.push(handler);
      this.handlers.set(key, list);
    }
    return this;
  }

  off(events?: string): this {
    if (!events) {
      this.handlers.clear();
      return this;
    }
    for (const key of events.split(" ").filter(Boolean)) {
      for (const existing of [...this.handlers.keys()]) {
        const [type, ns] = existing.split(".");
        const [offType, offNs] = key.split(".");
        if ((offType === "" || offType === type) && (!offNs || offNs === ns)) {
          this.handlers.delete(existing);
        }
      }
    }
    return this;
  }

  /** Calls the handlers registered for an event type (namespaces ignored). */
  fire(type: string, event: Record<string, any> = {}): this {
    for (const [key, list] of this.handlers) {
      if (key.split(".")[0] === type) {
        [...list].forEach((handler) => handler({ type, target: this, ...event }));
      }
    }
    return this;
  }

  /** Descendants matching a `.name` selector or a predicate. */
  find(selector: string | ((node: FakeNode) => boolean)): FakeNode[] {
    const match = typeof selector === "function"
      ? selector
      : (node: FakeNode) => String(node.attrs.name ?? "").split(" ").includes(selector.slice(1));
    const found: FakeNode[] = [];
    const walk = (node: FakeNode) => {
      for (const child of node.children) {
        if (match(child)) found.push(child);
        walk(child);
      }
    };
    walk(this);
    return found;
  }

  findOne(selector: string | ((node: FakeNode) => boolean)): FakeNode | undefined {
    return this.find(selector)[0];
  }
}

for (const attr of ATTRS) {
  (FakeNode.prototype as any)[attr] = function (this: FakeNode, value?: unknown) {
    if (value !== undefined) {
      this.attrs[attr] = value;
      return this;
    }
    return this.attrs[attr] ?? DEFAULTS[attr];
  };
}

export class FakeGroup extends FakeNode {}
export class FakeLayer extends FakeGroup {}
export class FakeRect extends FakeNode {}
export class FakeText extends FakeNode {}
export class FakeCircle extends FakeNode {}
export class FakePath extends FakeNode {}
export class FakeLine extends FakeNode {}
export class FakeStar extends FakeNode {}

export class FakeStage extends FakeGroup {
  private readonly containerElement = { style: {} as Record<string, string> };

  container(): { style: Record<string, string> } {
    return this.containerElement;
  }
}

/** Every Text node under `root` whose text matches. */
export function textNodes(root: FakeNode): FakeNode[] {
  return root.find((node) => node instanceof FakeText);
}

/** The visible texts under `root`, in tree order. */
export function visibleTexts(root: FakeNode): string[] {
  return textNodes(root).filter((node) => node.isVisible()).map((node) => String(node.text()));
}

const Konva = {
  Node: FakeNode,
  Group: FakeGroup,
  Layer: FakeLayer,
  Rect: FakeRect,
  Text: FakeText,
  Circle: FakeCircle,
  Path: FakePath,
  Line: FakeLine,
  Star: FakeStar,
  Stage: FakeStage,
};

export default Konva;
