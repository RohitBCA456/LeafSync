import { Request, Response, NextFunction, RequestHandler } from "express";

export const asyncHandler = <Type>(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<Type>,
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
