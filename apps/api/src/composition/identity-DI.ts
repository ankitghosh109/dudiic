import { RegisterUserUseCase } from '../modules/identity/application/use-cases/register-user.use-case.impl.js';
import { BcryptPasswordHasher } from '../modules/identity/infrastructure/security/bcrypt-password-hasher.js';
import { PostgresUserRepository } from '../modules/identity/infrastructure/persistence/postgres-user-repository.js';
import { IdentityController } from '../modules/identity/presentation/contorllers/identity.controller.js';
import { LoginUserUseCase } from '../modules/identity/application/use-cases/login-user.use-case.impl.js';
import { PostgresSessionRepository } from '../modules/identity/infrastructure/persistence/postgres-session-repository.js';
import { LogoutUserUseCase } from '../modules/identity/application/use-cases/logout-user.use-case.impl.js';

const userRepository = new PostgresUserRepository();
const passwordHasher = new BcryptPasswordHasher();
const sessionRepository = new PostgresSessionRepository();
const registerUser = new RegisterUserUseCase(userRepository, passwordHasher);
const loginUser = new LoginUserUseCase(userRepository, passwordHasher, sessionRepository);
const logoutUser = new LogoutUserUseCase(sessionRepository);

export const identityController = new IdentityController(registerUser, loginUser, logoutUser);
