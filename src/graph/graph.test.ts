import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GRAPH_MAX_X,
  DEFAULT_GRAPH_MAX_Y,
  DEFAULT_GRAPH_MIN_X,
  DEFAULT_GRAPH_MIN_Y,
  equationFromConfig,
  parseEquation,
} from './graph';

describe('graph equation parsing', () => {
  it.each([
    ['y = 1 * x + 1', 1, 1],
    ['y = -2 * x - 3', -2, -3],
    ['y = 0.5 * x - 1.25', 0.5, -1.25],
    [' y = -1 * x + .75 ', -1, 0.75],
  ])('parses linear equation %s', (equation, slope, yOffset) => {
    expect(parseEquation(equation)).toMatchObject({
      minX: DEFAULT_GRAPH_MIN_X,
      maxX: DEFAULT_GRAPH_MAX_X,
      minY: DEFAULT_GRAPH_MIN_Y,
      maxY: DEFAULT_GRAPH_MAX_Y,
      slope,
      yOffset,
    });
  });

  it.each([
    ['y = 1 * x * x + 2 * x + 3', 1, 2, 3],
    ['y = -1 * x * x - 2 * x - 3', -1, -2, -3],
    ['y = 0.5 * x * x - .25 * x + 1.75', 0.5, -0.25, 1.75],
  ])('parses quadratic equation %s', (equation, a, b, c) => {
    expect(parseEquation(equation)).toMatchObject({ a, b, c });
  });

  it('rejects unsupported equation forms', () => {
    expect(() => parseEquation('x = 2 * y + 1')).toThrow(/Unsupported equation/);
    expect(() => parseEquation('y = m * x + b')).toThrow(/Unsupported equation/);
    expect(() => parseEquation('y = 2 * x')).toThrow(/Unsupported equation/);
    expect(() => parseEquation('not an equation')).toThrow(/Unsupported equation/);
  });
});

describe('equationFromConfig', () => {
  it('formats a line configuration with a positive offset', () => {
    expect(equationFromConfig({
      minX: -3,
      maxX: 3,
      minY: -3,
      maxY: 3,
      slope: 2,
      yOffset: 1,
    })).toBe('y = 2 * x + 1');
  });

  it('formats a line configuration with a negative offset', () => {
    expect(equationFromConfig({
      minX: -3,
      maxX: 3,
      minY: -3,
      maxY: 3,
      slope: -2,
      yOffset: -1,
    })).toBe('y = -2 * x - 1');
  });

  it('formats a quadratic configuration with signed terms', () => {
    expect(equationFromConfig({
      minX: -3,
      maxX: 3,
      minY: -3,
      maxY: 3,
      a: -1,
      b: 2,
      c: -3,
    })).toBe('y = -1 * x * x + 2 * x - 3');
  });

  it('rejects a configuration without complete coefficients', () => {
    expect(() => equationFromConfig({
      minX: -3,
      maxX: 3,
      minY: -3,
      maxY: 3,
    })).toThrow(/must describe either/);
  });
});
