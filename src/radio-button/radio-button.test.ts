import { describe, expect, it, vi } from 'vitest';

vi.mock('konva', () => import('../screens/testing/fakeKonva'));

import RadioButton from './radio-button';

describe('RadioButton', () => {
  it('starts empty and can be selected and cleared', () => {
    const button = new RadioButton(28, 'white', 'gray', 'black');

    expect(button.isClicked()).toBe(false);
    button.click();
    expect(button.isClicked()).toBe(true);
    button.clear();
    expect(button.isClicked()).toBe(false);
  });

  it('fires onClick once and ignores a repeated click while selected', () => {
    const button = new RadioButton(28, 'white', 'gray', 'black');
    const onClick = vi.fn();
    button.onClick = onClick;

    button.fire('click');
    button.fire('click');

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(button.isClicked()).toBe(true);
  });

  it('can be selected again after clear', () => {
    const button = new RadioButton(28, 'white', 'gray', 'black');
    const onClick = vi.fn();
    button.onClick = onClick;

    button.fire('click');
    button.clear();
    button.fire('click');

    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('does not react while disabled and reacts after enable', () => {
    const button = new RadioButton(28, 'white', 'gray', 'black');
    const onClick = vi.fn();
    button.onClick = onClick;

    button.disable();
    button.fire('click');
    expect(onClick).not.toHaveBeenCalled();

    button.enable();
    button.fire('click');
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
