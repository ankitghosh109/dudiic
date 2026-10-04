import { User } from '../../domain/entities/user.entity.js';
import { UserRepository } from '../../domain/repositories/user-repository.js';
import { db } from '../../../../shared-infrastructure/database/prisma-postgresdb-config/db.js';
import { UserMapper } from '../mappers/user.mapper.js';

export class PostgresUserRepository implements UserRepository {
  async findByEmail(email: string) {
    const user = await db.orm.public.User.where({ email }).first();

    if (!user) {
      return null;
    }

    return UserMapper.toDomain(user);
  }

  async save(user: User) {
    const data = UserMapper.toPersistence(user);

    await db.orm.public.User.create(data);
  }
}
