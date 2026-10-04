import { Temporal } from 'temporal-polyfill';

import { Session } from '../../domain/entities/session.entity';
import { UserId } from '../../domain/value-objects/user-id.vo';

export class SessionMapper {
  static toDomain(data: {
    id: string;
    userId: string;
    expiresAt: Date | Temporal.Instant;
    createdAt: Date | Temporal.Instant;
  }): Session {
    return Session.create(data.id, UserId.create(data.userId), data.expiresAt, data.createdAt);
  }

  static toPersistence(session: Session) {
    return {
      id: session.getId,
      userId: session.getUserId,
      expiresAt: session.getExpiresAt,
      createdAt: session.getCreatedAt,
    };
  }
}
