import { beforeAll, afterAll, describe, expect, it, vi } from 'vitest';

vi.mock('konva', () => import('../screens/testing/fakeKonva'));

import Konva from 'konva';
import type { FakeNode } from '../screens/testing/fakeKonva';
import LaserMatchView from './laser-match-view';

// fake Konva doesn't implement easing.
 // provide a placeholder for hover animation tests.
Object.assign(Konva, {
  Easings: {
    EaseOut: (t: number) => t,
  },
});

describe('LaserMatchView', () => {
  it('highlights the graph card when clicked', () => {
  const stage = new Konva.Stage({});
  const layer = new Konva.Layer();
  stage.add(layer);

  const graph = new Konva.Group();

  const view = new LaserMatchView(
    { layer, x: 0, y: 0, width: 300, height: 200 },
    [['y = 1 * x + 1', graph]],
  );

  // get the card containing our graph
  const graphCard = graph.getParent() as unknown as FakeNode;

  // simulate clicking the card
  graphCard.fire('click');

  // the first child is our blue screen rectangle
  const screen = graphCard.getChildren()[0];

  expect(screen.stroke()).toBe('#ffd443');

  view.destroy();
  });

  it('calls onMatch when an equation and graph are selected', () => {
    const stage = new Konva.Stage({});
    const layer = new Konva.Layer();
    stage.add(layer);

    const graph = new Konva.Group();
    const equation = 'y = 1 * x + 1';

    const view = new LaserMatchView(
      { layer, x: 0, y: 0, width: 300, height: 200 },
      [[equation, graph]],
    );

    // mock callback to track matching attempts
    const onMatch = vi.fn();
    view.onMatch = onMatch;

    // find the equation and graph cards
    const root = layer.getChildren()[0] as unknown as FakeNode;

    const equationCard = root.getChildren().find(child =>
      child.getChildren().some(node => node.text() === 'y = x + 1')
    );

    const graphCard = graph.getParent() as unknown as FakeNode;

    expect(equationCard).toBeDefined();

    // click equation first
    equationCard?.fire('click');

    expect(onMatch).not.toHaveBeenCalled();

    // click graph second
    graphCard.fire('click');

    expect(onMatch).toHaveBeenCalledTimes(1);
    expect(onMatch).toHaveBeenCalledWith(equation, 0);

    view.destroy();
  });


  // Helpers for the remaining tests
  const E1 = 'y = 1 * x + 1';
  const E2 = 'y = 2 * x + 2';
  const E3 = 'y = -1 * x + 2';

  function setup(equations: string[] = [E1]) {
    const stage = new Konva.Stage({});
    const layer = new Konva.Layer();
    stage.add(layer);

    const graphs = equations.map(() => new Konva.Group());

    const entries: [string, Konva.Group][] = equations.map(
      (equation, index) => [equation, graphs[index]]
    );

    const view = new LaserMatchView(
      { layer, x: 0, y: 0, width: 960, height: 480 },
      entries
    );

    const root = layer.getChildren()[0] as unknown as FakeNode;

    return { view, layer, root, graphs };
  }

  function findEquationCard(
    root: FakeNode,
    displayedEquation: string
  ): FakeNode {
    const card = root.getChildren().find(child =>
      child.getChildren().some(
        node => node.text() === displayedEquation
      )
    );

    if (!card) {
      throw new Error(`Equation card not found: ${displayedEquation}`);
    }

    return card;
  }

  function findGraphCard(graph: Konva.Group): FakeNode {
    const card = graph.getParent() as unknown as FakeNode | null;

    if (!card) {
      throw new Error('Graph card not found');
    }

    return card;
  }

  function getScreen(card: FakeNode): FakeNode {
    return card.getChildren()[0];
  }

  // Fake Konva doesn't support .to() animations.
  // Simulate animations completing immediately for tests.
  const fakePrototype = Konva.Node.prototype as unknown as {
    to?: (
      this: Konva.Node,
      config: Record<string, unknown>
    ) => void;
  };

  const originalTo = fakePrototype.to;

  beforeAll(() => {
    fakePrototype.to = function (
      this: Konva.Node,
      config: Record<string, unknown>
    ): void {
      for (const [key, value] of Object.entries(config)) {
        if (key !== 'duration' && key !== 'onFinish') {
          this.setAttr(key, value);
        }
      }

      if (typeof config.onFinish === 'function') {
        config.onFinish();
      }
    };
  });

  afterAll(() => {
    if (originalTo) {
      fakePrototype.to = originalTo;
    } else {
      delete fakePrototype.to;
    }
  });

  it('clears the previous equation highlight', () => {
    const { view, root } = setup([E1, E2]);

    const first = findEquationCard(root, 'y = x + 1');
    const second = findEquationCard(root, 'y = 2x + 2');

    first.fire('click');

    expect(getScreen(first).stroke()).toBe('#ffd443');

    second.fire('click');

    expect(getScreen(first).stroke()).toBe('#4b6881');
    expect(getScreen(second).stroke()).toBe('#ffd443');

    view.destroy();
  });

  it('clears the previous graph highlight', () => {
    const { view, graphs } = setup([E1, E2]);

    const first = findGraphCard(graphs[0]);
    const second = findGraphCard(graphs[1]);

    first.fire('click');

    expect(getScreen(first).stroke()).toBe('#ffd443');

    second.fire('click');

    expect(getScreen(first).stroke()).toBe('#4b6881');
    expect(getScreen(second).stroke()).toBe('#ffd443');

    view.destroy();
  });

  it('allows selecting a graph before an equation', () => {
    const { view, root, graphs } = setup();

    const onMatch = vi.fn();
    view.onMatch = onMatch;

    const equationCard = findEquationCard(root, 'y = x + 1');
    const graphCard = findGraphCard(graphs[0]);

    graphCard.fire('click');

    expect(onMatch).not.toHaveBeenCalled();

    equationCard.fire('click');

    expect(onMatch).toHaveBeenCalledTimes(1);
    expect(onMatch).toHaveBeenCalledWith(E1, 0);

    view.destroy();
  });

  it('resets card highlights after an incorrect match', () => {
    const { view, root, graphs } = setup();

    const equationCard = findEquationCard(root, 'y = x + 1');
    const graphCard = findGraphCard(graphs[0]);

    const onSolved = vi.fn();
    view.onSolved = onSolved;

    equationCard.fire('click');
    graphCard.fire('click');

    view.incorrect(E1, 0);

    expect(getScreen(equationCard).stroke()).toBe('#4b6881');
    expect(getScreen(graphCard).stroke()).toBe('#4b6881');

    expect(onSolved).not.toHaveBeenCalled();

    view.destroy();
  });

  it('does not disable a security laser for an incorrect match', () => {
    const { view, root, graphs } = setup();

    const indicator = root.getChildren().find(
      node => node.fill() === '#fb4760'
    );

    expect(indicator).toBeDefined();

    findEquationCard(root, 'y = x + 1').fire('click');
    findGraphCard(graphs[0]).fire('click');

    view.incorrect(E1, 0);

    expect(indicator?.fill()).toBe('#fb4760');

    view.destroy();
  });

  it('locks and fades correctly matched cards', () => {
    const { view, root, graphs } = setup();

    const equationCard = findEquationCard(root, 'y = x + 1');
    const graphCard = findGraphCard(graphs[0]);

    const onSolved = vi.fn();
    view.onSolved = onSolved;

    equationCard.fire('click');
    graphCard.fire('click');

    view.solve(E1);

    // cards should no longer accept clicks
    expect(equationCard.listening()).toBe(false);
    expect(graphCard.listening()).toBe(false);

    // screens should become gray
    expect(getScreen(equationCard).fill()).toBe('#697786');
    expect(getScreen(graphCard).fill()).toBe('#697786');

    // cards should become dimmer
    expect(equationCard.opacity()).toBe(0.6);
    expect(graphCard.opacity()).toBe(0.6);

    // notify the puzzle once
    expect(onSolved).toHaveBeenCalledTimes(1);
    expect(onSolved).toHaveBeenCalledWith(E1);

    view.destroy();
  });

  it('disables all three lasers from right to left', () => {
    const { view, root, graphs } = setup([E1, E2, E3]);

    const onSolved = vi.fn();
    view.onSolved = onSolved;

    const indicators = root.getChildren().filter(
      node => node.fill() === '#fb4760'
    );

    expect(indicators).toHaveLength(3);

    const pairs = [
      { equation: E1, display: 'y = x + 1', graph: graphs[0] },
      { equation: E2, display: 'y = 2x + 2', graph: graphs[1] },
      { equation: E3, display: 'y = -x + 2', graph: graphs[2] },
    ];

    pairs.forEach(({ equation, display, graph }, index) => {
      findEquationCard(root, display).fire('click');
      findGraphCard(graph).fire('click');

      view.solve(equation);

      // rightmost active laser should turn gray
      expect(indicators[2 - index].fill()).toBe('#596472');

      expect(onSolved).toHaveBeenCalledTimes(index + 1);
    });

    // all lasers should be disabled
    expect(indicators.map(laser => laser.fill())).toEqual([
      '#596472',
      '#596472',
      '#596472',
    ]);

    view.destroy();
  });

  it('removes the laser panel when destroyed', () => {
    const { view, layer } = setup();

    view.destroy();

    expect(layer.getChildren()).toHaveLength(0);

    expect(view.onMatch).toBeUndefined();
    expect(view.onSolved).toBeUndefined();
  });


  it('updates equation status labels when selected and incorrect', () => {
    const { view, root, graphs } = setup();

    const equationCard = findEquationCard(root, 'y = x + 1');
    const graphCard = findGraphCard(graphs[0]);

    const hasLabel = (label: string) =>
      equationCard.getChildren().some(
        node => node.text() === label
      );

    expect(hasLabel('SELECT')).toBe(true);

    equationCard.fire('click');

    expect(hasLabel('SELECTED')).toBe(true);

    graphCard.fire('click');
    view.incorrect(E1, 0);

    expect(hasLabel('SELECT')).toBe(true);

    view.destroy();
  });


  it('updates matched label, laser status, and active counter', () => {
    const { view, root, graphs } = setup();

    const equationCard = findEquationCard(root, 'y = x + 1');
    const graphCard = findGraphCard(graphs[0]);

    const activeLabel = root.getChildren().find(
      node => node.text() === '1 active'
    );

    const laserLabel = root.getChildren().find(
      node => node.text() === 'ON'
    );

    expect(activeLabel).toBeDefined();
    expect(laserLabel).toBeDefined();

    equationCard.fire('click');
    graphCard.fire('click');

    view.solve(E1);

    expect(
      equationCard.getChildren().some(
        node => node.text() === 'MATCHED'
      )
    ).toBe(true);

    expect(laserLabel?.text()).toBe('OFF');
    expect(activeLabel?.text()).toBe('0 active');

    view.destroy();
  });


  it('applies hover scaling and selected glow', () => {
    const { view, root } = setup();

    const equationCard = findEquationCard(root, 'y = x + 1');
    const screen = getScreen(equationCard);

    equationCard.fire('mouseenter');

    expect(equationCard.getAttr('scaleX')).toBe(1.03);
    expect(equationCard.getAttr('scaleY')).toBe(1.03);

    equationCard.fire('mouseleave');

    expect(equationCard.getAttr('scaleX')).toBe(1);
    expect(equationCard.getAttr('scaleY')).toBe(1);

    equationCard.fire('click');

    expect(screen.stroke()).toBe('#ffd443');
    expect(screen.getAttr('shadowColor')).toBe('#ffd443');
    expect(screen.getAttr('shadowBlur')).toBe(14);

    view.destroy();
  });

  it('resets hovered cards to normal size after matching', () => {
    const { view, root, graphs } = setup();

    const equationCard = findEquationCard(root, 'y = x + 1');
    const graphCard = findGraphCard(graphs[0]);

    // simulate hovering over both cards
    equationCard.fire('mouseenter');
    graphCard.fire('mouseenter');

    // cards should grow on hover
    expect(equationCard.getAttr('scaleX')).toBe(1.03);
    expect(graphCard.getAttr('scaleX')).toBe(1.03);

    // complete a correct match
    equationCard.fire('click');
    graphCard.fire('click');
    view.solve(E1);

    // both cards should return to normal size
    expect(equationCard.getAttr('scaleX')).toBe(1);
    expect(equationCard.getAttr('scaleY')).toBe(1);
    expect(graphCard.getAttr('scaleX')).toBe(1);
    expect(graphCard.getAttr('scaleY')).toBe(1);

    view.destroy();
  });





});
