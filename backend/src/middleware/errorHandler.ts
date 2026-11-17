import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction): void => {
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'validation_error',
      message: 'Invalid request data',
      fieldErrors: err.errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  if (err.statusCode) {
    res.status(err.statusCode).json({
      error: err.errorCode || 'error',
      message: err.message,
    });
    return;
  }

  console.error('Unhandled server error:', err);
  res.status(500).json({
    error: 'internal_server_error',
    message: err.message || 'An unexpected error occurred',
  });
};
