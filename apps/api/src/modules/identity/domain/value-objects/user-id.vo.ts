export class UserId {
  private constructor(private readonly value: string) {}

  static create(value: string): UserId {
    if (!value) {
      throw new Error('Invalid user ID');
    }

    return new UserId(value);
  }

  get getValue(): string {
    return this.value;
  }
}
