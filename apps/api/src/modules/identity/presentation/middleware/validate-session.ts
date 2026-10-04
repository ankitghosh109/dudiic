import { Request, Response, NextFunction } from 'express';
import { SessionRepository } from '../../domain/repositories/session-repository.js';
import { UserId } from '../../domain/value-objects/user-id.vo.js';

//  start >>> i will research about this later
declare global {
  namespace Express {
    interface Request {
      userId?: UserId;
    }
  }
}
// <<< end

export function validateSession(sessionRepository: SessionRepository) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sessionId = req.cookies.session_id;

      if (!sessionId) {
        return res.status(401).json({
          message: 'Unauthorized',
        });
      }

      const session = await sessionRepository.findById(sessionId);

      if (!session) {
        return res.status(401).json({
          message: 'Invalid or expired session',
        });
      }

      req.userId = session.userId;

      next();
    } catch (error) {
      next(error);
    }
  };
}
