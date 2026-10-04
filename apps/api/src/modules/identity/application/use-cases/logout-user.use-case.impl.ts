import { SessionRepository } from '../../domain/repositories/session-repository';

export interface LogoutUser {
  execute(input: { sessionId: string }): Promise<{
    sessionId: string;
  }>;
}

export class LogoutUserUseCase implements LogoutUser {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async execute(input: { sessionId: string }) {
    const sessionId = input.sessionId;
    await this.sessionRepository.delete(sessionId);
    return {
      sessionId,
    };
  }
}
