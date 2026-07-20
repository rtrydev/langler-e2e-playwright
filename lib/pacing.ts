export class PacedQueue {
  private tail: Promise<unknown> = Promise.resolve();
  private lastStart = 0;

  constructor(private readonly minIntervalMs: number) {}

  run<T>(task: () => Promise<T>): Promise<T> {
    const scheduled = this.tail.then(async () => {
      const wait = this.minIntervalMs - (Date.now() - this.lastStart);
      if (wait > 0) {
        await new Promise((resolve) => setTimeout(resolve, wait));
      }
      this.lastStart = Date.now();
      return task();
    });
    this.tail = scheduled.then(
      () => undefined,
      () => undefined,
    );
    return scheduled;
  }
}
