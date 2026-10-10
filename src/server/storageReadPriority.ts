export class StorageReadBusyError extends Error {
  constructor() { super('STORAGE_READ_BUSY'); }
}

export class StudentReadQueue {
  private active = 0;
  private readonly waiting: { start: () => void; timer: ReturnType<typeof setTimeout> }[] = [];

  constructor(private readonly concurrency = 2, private readonly maximumWaiting = 64, private readonly waitMs = 2000) {}

  run<T>(read: () => Promise<T>): Promise<T> {
    if (this.active < this.concurrency) return this.execute(read);
    if (this.waiting.length >= this.maximumWaiting) return Promise.reject(new StorageReadBusyError());
    return new Promise<T>((resolve, reject) => {
      const pending = {
        start: () => { clearTimeout(pending.timer); resolve(this.execute(read)); },
        timer: setTimeout(() => {
          const index = this.waiting.indexOf(pending);
          if (index !== -1) this.waiting.splice(index, 1);
          reject(new StorageReadBusyError());
        }, this.waitMs),
      };
      this.waiting.push(pending);
    });
  }

  private async execute<T>(read: () => Promise<T>): Promise<T> {
    this.active += 1;
    try { return await read(); }
    finally {
      this.active -= 1;
      this.waiting.shift()?.start();
    }
  }
}

const studentReads = new StudentReadQueue();

// Instance-local admission for reads only. Signed teacher sessions never enter
// the student queue; writes and receipt confirmation use their existing paths.
export const prioritizeStorageRead = <T>(role: 'teacher' | 'student', read: () => Promise<T>): Promise<T> => (
  role === 'teacher' || process.env.STORAGE_TEACHER_PRIORITY !== '1' ? read() : studentReads.run(read)
);
