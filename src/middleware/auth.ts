import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { RequestHandler } from 'express';

export interface AuthRequest extends Request {
  user?: { _id: string; username: string; role: string; isAdmin: boolean };
}

const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret';

export const authMiddleware: RequestHandler = (req: AuthRequest, res: Response, next: NextFunction): void => {
  console.log('Auth middleware: Processing request for', req.originalUrl);
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('Auth middleware: No token provided for', req.originalUrl);
    res.status(401).json({ message: 'No token provided' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthRequest['user'];

    if (!decoded?._id) {
      console.log('Auth middleware: Invalid token payload');
      res.status(401).json({ message: 'Invalid token payload' });
      return;
    }

    console.log('Auth middleware: Token verified, userId:', decoded._id);
    req.user = decoded;
    next();
  } catch (error: any) {
    console.error('Auth middleware: Error verifying token:', error.message);
    res.status(401).json({ message: 'Invalid or expired token' });
    return;
  }
};
