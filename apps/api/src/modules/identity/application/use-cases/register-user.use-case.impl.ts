import { randomUUID } from 'node:crypto';

import { User } from '../../domain/entities/user.js';
import { UserRepository } from '../../domain/repositories/user-repository.js';
import { PasswordHasher } from '../port/password-hasher.js';
import { RegisterUserDto } from '../dto/register-user.dto.js';
import { Email } from '../../domain/value-objects/email.vo.js';
import { UserId } from '../../domain/value-objects/user-id.vo.js';
import { UserPassword } from '../../domain/value-objects/user-password.vo.js';

export class RegisterUser {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(dto: RegisterUserDto) {
    const existingUser = await this.userRepository.findByEmail(dto.email);

    if (existingUser) {
      throw new Error('User already exists');
    }

    const passwordHash = await this.passwordHasher.hash(dto.password);

    const user = User.create({
      id: UserId.create(randomUUID()),
      email: Email.create(dto.email),
      passwordHash: UserPassword.create(passwordHash),
      createdAt: new Date(),
    });

    await this.userRepository.save(user);

    return {
      id: user.id,
      email: user.email,
    };
  }
}
