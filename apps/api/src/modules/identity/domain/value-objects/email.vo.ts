export class Email {
  private constructor(private readonly value: string) {}

  static create(value: string): Email {
    if (!value.includes('@')) {
      throw new Error('Invalid email');
    }

    return new Email(value);
  }

  get getValue(): string {
    return this.value;
  }
}
