import { randomUUID } from 'node:crypto';
import { User } from '../../domain/entities/user.entity.js';
import { UserRepository } from '../../domain/repositories/user-repository.js';
import { PasswordHasher } from '../ports/password-hasher.js';
import { RegisterUserDto } from '../dto/register-user.dto.js';
import { Email } from '../../domain/value-objects/email.vo.js';
import { UserId } from '../../domain/value-objects/user-id.vo.js';
import { UserPassword } from '../../domain/value-objects/user-password.vo.js';
import { Temporal } from 'temporal-polyfill';

export interface RegisterUser {
  execute(input: { email: string; password: string }): Promise<{
    id: string;
    email: string;
  }>;
}
export class RegisterUserUseCase implements RegisterUser {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(input: RegisterUserDto) {
    const existingUser = await this.userRepository.findByEmail(input.email);

    if (existingUser) {
      throw new Error('User already exists');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);

    const userEntity = User.create(
      UserId.create(randomUUID()),
      Email.create(input.email),
      UserPassword.create(passwordHash),
      Temporal.Now.instant(),
    );

    await this.userRepository.save(userEntity);

    return {
      id: userEntity.getId,
      email: userEntity.getEmail,
    };
  }
}
