import { Temporal } from 'temporal-polyfill';
import { Email } from '../value-objects/email.vo.js';
import { UserId } from '../value-objects/user-id.vo.js';
import { UserPassword } from '../value-objects/user-password.vo.js';

export class User {
  private constructor(
    private readonly id: UserId,
    private readonly email: Email,
    private readonly passwordHash: UserPassword,
    private readonly createdAt: Date | Temporal.Instant,
  ) {}

  static create(
    id: UserId,
    email: Email,
    passwordHash: UserPassword,
    createdAt: Date | Temporal.Instant,
  ): User {
    return new User(id, email, passwordHash, createdAt);
  }

  get getId(): string {
    return this.id.getValue;
  }

  get getEmail(): string {
    return this.email.getValue;
  }

  get getPasswordHash(): string {
    return this.passwordHash.getValue;
  }

  get getCreatedAt(): Date | Temporal.Instant {
    return this.createdAt;
  }
}
