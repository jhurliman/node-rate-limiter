/** Serialize waiting requests so a backlog needs only one active timer. */
export class RequestQueue {
  private tail?: Promise<void>;

  run<T>(request: () => Promise<T>): Promise<T> {
    const result = this.tail ? this.tail.then(request) : request();
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    this.tail = tail;
    void tail.then(() => {
      if (this.tail === tail) this.tail = undefined;
    });
    return result;
  }
}
