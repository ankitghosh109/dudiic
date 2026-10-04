import { Router } from 'express';
import { identityController } from '../../../../composition/identity-DI.js';
import { validateRequest } from '../middleware/validate-request.js';
import { registerUserSchema } from '../validators/register-user.schema.js';
import { loginUserSchema } from '../validators/login-user.schema.js';

const router = Router();

router.post(
  '/register',
  validateRequest(registerUserSchema),
  identityController.register.bind(identityController),
);

router.post(
  '/login',
  validateRequest(loginUserSchema),
  identityController.login.bind(identityController),
);

router.post('/logout', identityController.logout.bind(identityController));

export default router;
