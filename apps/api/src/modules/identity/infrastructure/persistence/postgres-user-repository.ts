import { User } from '../../domain/entities/user.js';
import { UserRepository } from '../../domain/repositories/user-repository.js';
import { db } from '../../../../shared-infrastructure/database/prisma-postgresdb-config/db.js';

export class PostgresUserRepository implements UserRepository {
  async findByEmail(email: string) {
    const user = await db.orm.public.User.where({ email }).first();

    if (!user) {
      return null;
    }

    return User.create({
      id: user.id,
      email: user.email,
      passwordHash: user.password,
      createdAt: user.createdAt,
    });
  }

  async save(user: User) {
    await db.orm.public.User.create({
      id: user.id,
      email: user.email,
      password: user.passwordHash,
    });
  }
}
