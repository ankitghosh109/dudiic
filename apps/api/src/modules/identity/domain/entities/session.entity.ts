import { randomUUID } from 'node:crypto';
import { UserId } from '../value-objects/user-id.vo';
import { Temporal } from 'temporal-polyfill';

export class Session {
  constructor(
    private readonly id: string,
    private readonly userId: UserId,
    private readonly expiresAt: Date | Temporal.Instant,
    private readonly createdAt: Date | Temporal.Instant,
  ) {}

  static create(
    id: string,
    userId: UserId,
    expiresAt: Date | Temporal.Instant,
    createdAt: Date | Temporal.Instant,
  ): Session {
    return new Session(id, userId, expiresAt, createdAt);
  }

  isExpired(): boolean {
    return new Date() >= this.expiresAt;
  }

  get getId(): string {
    return this.id;
  }

  get getUserId(): string {
    return this.userId.getValue;
  }

  get getExpiresAt(): Date | Temporal.Instant {
    return this.expiresAt;
  }

  get getCreatedAt(): Date | Temporal.Instant {
    return this.createdAt;
  }
}
