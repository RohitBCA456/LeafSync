import { Request, Response, NextFunction } from "express";
import { ApiError } from "../../utilities/ApiError.util";
import bcrypt from "bcrypt";
import { pool } from "../../config/db.config";
import { ApiResponse } from "../../utilities/ApiResponse";
import { asyncHandler } from "../../utilities/asyncHandler.util";

const register = asyncHandler(
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    const { name, email, password, ph_number } = req.body;

    if ([name, email, password, ph_number].some((field) => field.trim() === "")) {
      return next(new ApiError(400, "some fields are missing"));
    }

    if (!email.includes("@")) {
      return next(new ApiError(400, "not a valid email"));
    }

    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `
    INSERT INTO stg(name, email, password, ph_number) VALUES($1, $2, $3, $4)
    RETURNING id, name, email, ph_number;
    `,
      [name, email, hashPassword, ph_number],
    );

    return res
      .status(201)
      .json(
        new ApiResponse(201, result.rows[0], "STG registered successfully"),
      );
  },
);
