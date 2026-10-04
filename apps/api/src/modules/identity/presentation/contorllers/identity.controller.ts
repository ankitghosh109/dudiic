import { Request, Response } from 'express';

import { RegisterUser } from '../../application/use-cases/register-user.use-case.impl.js';
import { LoginUser } from '../../application/use-cases/login-user.use-case.impl.js';
import { LogoutUser } from '../../application/use-cases/logout-user.use-case.impl.js';

export class IdentityController {
  constructor(
    private readonly registerUser: RegisterUser,
    private readonly loginUser: LoginUser,
    private readonly logoutUser: LogoutUser,
  ) {}

  async register(req: Request, res: Response) {
    const result = await this.registerUser.execute({
      email: req.body.email,
      password: req.body.password,
    });

    return res.status(201).json(result);
  }

  async login(req: Request, res: Response) {
    const result = await this.loginUser.execute({
      email: req.body.email,
      password: req.body.password,
    });

    res.cookie('sessionId', result.sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 1000 * 60 * 60 * 24 * 7,
    });

    return res.status(200).json(result);
  }

  async logout(req: Request, res: Response) {
    const result = await this.logoutUser.execute({
      sessionId: req.cookies.sessionId,
    });

    res.clearCookie('session_id');

    return res.status(204).send();
  }
}
