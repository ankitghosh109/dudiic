import { randomUUID } from 'node:crypto';

import { User } from '../../domain/entities/user.js';
import { UserRepository } from '../../domain/repositories/user-repository.js';
import { PasswordHasher } from '../services/password-hasher.js';

interface RegisterUserInput {
  email: string;
  password: string;
}

export class RegisterUser {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async execute(input: RegisterUserInput) {
    const existingUser = await this.userRepository.findByEmail(input.email);

    if (existingUser) {
      throw new Error('User already exists');
    }

    const passwordHash = await this.passwordHasher.hash(input.password);

    const user = User.create({
      id: randomUUID(),
      email: input.email,
      passwordHash,
      createdAt: new Date(),
    });

    await this.userRepository.save(user);

    return {
      id: user.id,
      email: user.email,
    };
  }
}
