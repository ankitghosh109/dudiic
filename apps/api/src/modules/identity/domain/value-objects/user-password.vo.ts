export class UserPassword {
  private constructor(private readonly value: string) {}

  static create(value: string): UserPassword {
    if (!value) {
      throw new Error('Password hash cannot be empty');
    }

    return new UserPassword(value);
  }

  get getValue(): string {
    return this.value;
  }
}
