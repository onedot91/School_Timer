export class SpecialMotionSchedule {
  private appearances = 0;
  private target: number;
  private readonly random: () => number;
  generation = 0;

  constructor(random = Math.random) {
    this.random = random;
    this.target = this.nextTarget();
  }

  private nextTarget(): number {
    return 5 + Math.min(3, Math.max(0, Math.floor(this.random() * 4)));
  }

  recordAppearance(): boolean {
    this.appearances += 1;
    return this.appearances >= this.target;
  }

  complete(): void {
    this.appearances = 0;
    this.target = this.nextTarget();
    this.generation += 1;
  }
}
