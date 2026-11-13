import { describe, expect, it, vi } from 'vitest';

vi.mock('konva', () => import('../screens/testing/fakeKonva'));

import GraphMatchModel from './graph-match-model';

describe('GraphMatchModel', () => {
  it('adds an equation string and derives the corresponding graph', () => {
    const model = new GraphMatchModel();

    model.addGraph('y = 1 * x + 1');

    expect(model.graphs()).toHaveLength(1);
    expect(model.graphs()[0][0]).toBe('y = 1 * x + 1');
    expect(model.get(0)).toBe(model.graphs()[0][1]);
  });

  it('adds a line config and creates its equation text', () => {
    const model = new GraphMatchModel();

    model.addGraph({
      minX: -3,
      maxX: 3,
      minY: -3,
      maxY: 3,
      slope: -2,
      yOffset: 1,
    });

    expect(model.graphs()[0][0]).toBe('y = -2 * x + 1');
  });

  it('supports quadratic configurations and preserves insertion order', () => {
    const model = new GraphMatchModel();

    model.addGraph({ minX: -3, maxX: 3, minY: -3, maxY: 3, a: 1, b: 0, c: 2 });
    model.addGraph('y = -1 * x - 2');

    expect(model.graphs().map(entry => entry[0])).toEqual([
      'y = 1 * x * x + 0 * x + 2',
      'y = -1 * x - 2',
    ]);
  });

  it('returns a defensive copy from graphs', () => {
    const model = new GraphMatchModel();
    model.addGraph('y = 1 * x + 1');
    const entries = model.graphs();

    entries.pop();

    expect(model.graphs()).toHaveLength(1);
  });

  it('throws when an index is not present', () => {
    const model = new GraphMatchModel();

    expect(() => model.get(0)).toThrow(/No graph exists at index 0/);
  });
});
