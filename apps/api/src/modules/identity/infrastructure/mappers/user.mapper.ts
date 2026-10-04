// infrastructure/database/mappers/user.mapper.ts

import { User } from '../../domain/entities/user.entity';
import { Email } from '../../domain/value-objects/email.vo';
import { UserId } from '../../domain/value-objects/user-id.vo';
import { UserPassword } from '../../domain/value-objects/user-password.vo';

export class UserMapper {
  static toDomain(raw: { id: string; email: string; passwordHash: string; createdAt: Date }): User {
    return User.create(
      UserId.create(raw.id),
      Email.create(raw.email),
      UserPassword.create(raw.passwordHash),
      raw.createdAt,
    );
  }

  static toPersistence(user: User) {
    return {
      id: user.getId,
      email: user.getEmail,
      passwordHash: user.getPasswordHash,
      createdAt: user.getCreatedAt,
    };
  }
}
