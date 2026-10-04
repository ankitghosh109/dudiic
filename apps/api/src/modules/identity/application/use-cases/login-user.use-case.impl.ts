import { randomUUID } from 'node:crypto';
import { Session } from '../../domain/entities/session.entity.js';
import { SessionRepository } from '../../domain/repositories/session-repository.js';
import { UserRepository } from '../../domain/repositories/user-repository.js';
import { UserId } from '../../domain/value-objects/user-id.vo.js';
import { PasswordHasher } from '../ports/password-hasher.js';
import { Temporal } from 'temporal-polyfill';

export interface LoginUser {
  execute(input: { email: string; password: string }): Promise<{
    id: string;
    email: string;
    sessionId: string;
  }>;
}

export class LoginUserUseCase implements LoginUser {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly sessionRepository: SessionRepository,
  ) {}

  async execute(input: { email: string; password: string }) {
    const user = await this.userRepository.findByEmail(input.email);

    if (!user) {
      throw new Error('Invalid email or password');
    }

    const isPasswordValid = await this.passwordHasher.compare(input.password, user.getPasswordHash);

    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    const existingSessionEntity = await this.sessionRepository.findByUserId(user.getId);

    if (existingSessionEntity) {
      const existingSessionId = existingSessionEntity.getId;
      return {
        id: user.getId,
        email: user.getEmail,
        sessionId: existingSessionId,
      };
    } else {
      const sessionEntity = Session.create(
        randomUUID(),
        UserId.create(user.getId),
        Temporal.Now.instant().add({
          hours: 24 * 7,
        }),
        Temporal.Now.instant(),
      );
      const sessionId = await this.sessionRepository.save(sessionEntity);

      return {
        id: user.getId,
        email: user.getEmail,
        sessionId,
      };
    }
  }
}
