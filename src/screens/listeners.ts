import type { Unsubscribe } from "./contracts";

/** The callbacks registered through one screen `onX(cb)` method. */
export class Listeners<Args extends unknown[]> {
  private list: Array<(...args: Args) => void> = [];

  add(cb: (...args: Args) => void): Unsubscribe {
    this.list.push(cb);
    return () => {
      this.list = this.list.filter((l) => l !== cb);
    };
  }

  emit(...args: Args): void {
    [...this.list].forEach((cb) => cb(...args));
  }
}
