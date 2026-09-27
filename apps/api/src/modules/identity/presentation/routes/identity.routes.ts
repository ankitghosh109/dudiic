import { Router } from 'express';
import { identityController } from '../../../../composition/identity-DI.js';
import { validateRequest } from '../middleware/validate-request.js';
import { registerUserSchema } from '../validators/register-user-schema.js';

const router = Router();

router.post(
  '/register',
  validateRequest(registerUserSchema),
  identityController.register.bind(identityController),
);

export default router;
