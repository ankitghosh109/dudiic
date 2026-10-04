import { Session } from '../entities/session.entity.js';
import { UserId } from '../value-objects/user-id.vo.js';

export interface SessionRepository {
  save(session: Session): Promise<string>;

  findByUserId(userId: string): Promise<Session | null>;

  findById(sessionId: string): Promise<{
    sessionId: string;
    userId: UserId;
    expiresAt: Date;
  } | null>;

  delete(sessionId: string): Promise<void>;
}
