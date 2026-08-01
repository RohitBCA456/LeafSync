import { asyncHandler } from "../utilities/asyncHandler.util.js";
import { Request as ExpressRequest, Response, NextFunction } from "express";

interface AuthRequest extends ExpressRequest {
  user?: any;
}

import { verifyAccessToken } from "../utilities/token.util.js";
import { ApiError } from "../utilities/ApiError.util.js";

export const verifyJWT = asyncHandler(
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    if (!token) {
      return next(new ApiError(401, "Unauthorized access"));
    }

    try {
      const decoded = verifyAccessToken(token);
      req.user = decoded;
      next();
    } catch (error) {
      return next(new ApiError(401, "Access token expired or invalid"));
    }
  },
);
