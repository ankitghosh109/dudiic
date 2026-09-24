import { Request, Response } from 'express';

import { RegisterUser } from '../../application/use-cases/register-user.js';

export class IdentityController {
  constructor(private readonly registerUser: RegisterUser) {}

  async register(req: Request, res: Response) {
    const result = await this.registerUser.execute({
      email: req.body.email,
      password: req.body.password,
    });

    return res.status(201).json(result);
  }
}
