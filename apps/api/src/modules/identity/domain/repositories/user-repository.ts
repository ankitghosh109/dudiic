import { User } from '../entities/user.entity.js';

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;

  save(user: User): Promise<void>;
}
