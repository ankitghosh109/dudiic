import { Router } from 'express';
import { identityController } from '../../../../composition/identity-DI.js';

const router = Router();

router.post('/register', identityController.register.bind(identityController));

export default router;
