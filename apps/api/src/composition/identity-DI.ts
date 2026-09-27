import { RegisterUser } from '../modules/identity/application/use-cases/register-user.use-case.impl.js';
import { BcryptPasswordHasher } from '../modules/identity/infrastructure/security/bcrypt-password-hasher.js';
import { PostgresUserRepository } from '../modules/identity/infrastructure/persistence/postgres-user-repository.js';
import { IdentityController } from '../modules/identity/presentation/contorllers/identity.controller.js';

const userRepository = new PostgresUserRepository();

const passwordHasher = new BcryptPasswordHasher();

const registerUser = new RegisterUser(userRepository, passwordHasher);

export const identityController = new IdentityController(registerUser);
