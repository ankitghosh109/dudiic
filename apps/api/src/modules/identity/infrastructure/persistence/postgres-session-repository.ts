import { SessionRepository } from '../../domain/repositories/session-repository.js';
import { UserId } from '../../domain/value-objects/user-id.vo.js';
import { db } from '../../../../shared-infrastructure/database/prisma-postgresdb-config/db.js';
import { Session } from '../../domain/entities/session.entity.js';
import { SessionMapper } from '../mappers/session.mapper.js';
import { Temporal } from 'temporal-polyfill';

export class PostgresSessionRepository implements SessionRepository {
  async save(session: Session): Promise<string> {
    const data = SessionMapper.toPersistence(session);
    await db.orm.public.Session.create(data);
    return data.id;
  }

  async findByUserId(userId: string) {
    const session = await db.orm.public.Session.where({
      userId,
    })
      .where((session) => session.expiresAt.gt(Temporal.Now.instant()))
      .first();

    if (!session) {
      return null;
    }

    return SessionMapper.toDomain(session);
  }

  async findById(sessionId: string) {
    const session = await db.orm.public.Session.where({
      id: sessionId,
    }).first();

    if (!session) {
      return null;
    }

    const expiresAt = new Date(Number(session.expiresAt.epochMilliseconds));

    if (expiresAt <= new Date()) {
      await this.delete(sessionId);
      return null;
    }

    return {
      sessionId: session.id,
      userId: UserId.create(session.userId),
      expiresAt,
    };
  }

  async delete(sessionId: string): Promise<void> {
    await db.orm.public.Session.where({ id: sessionId }).delete();
  }
}
