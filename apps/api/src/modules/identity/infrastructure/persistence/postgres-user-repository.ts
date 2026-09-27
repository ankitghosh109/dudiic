import { User } from '../../domain/entities/user.js';
import { UserRepository } from '../../domain/repositories/user-repository.js';
import { db } from '../../../../shared-infrastructure/database/prisma-postgresdb-config/db.js';
import { Email } from '../../domain/value-objects/email.vo.js';
import { UserId } from '../../domain/value-objects/user-id.vo.js';
import { UserPassword } from '../../domain/value-objects/user-password.vo.js';

export class PostgresUserRepository implements UserRepository {
  async findByEmail(email: string) {
    const user = await db.orm.public.User.where({ email }).first();

    if (!user) {
      return null;
    }

    return User.create({
      id: UserId.create(user.id),
      email: Email.create(user.email),
      passwordHash: UserPassword.create(user.password),
      createdAt: user.createdAt,
    });
  }

  async save(user: User) {
    await db.orm.public.User.create({
      id: user.id.getValue(),
      email: user.email.getValue(),
      password: user.passwordHash.getValue(),
    });
  }
}
