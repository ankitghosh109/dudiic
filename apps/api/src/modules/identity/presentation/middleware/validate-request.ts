// presentation/http/middlewares/validate.ts

import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export function validateRequest(schema: z.ZodType) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).json({
        message: 'Invalid request',
        errors: result.error.issues,
      });
    }

    req.body = result.data;

    next();
  };
}
