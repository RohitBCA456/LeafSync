import { Request, Response, NextFunction } from "express";
import { ApiError } from "../../utilities/ApiError.util";
import bcrypt from "bcrypt";
import { pool } from "../../config/db.config";
import { ApiResponse } from "../../utilities/ApiResponse";
import { asyncHandler } from "../../utilities/asyncHandler.util";
import { RegisterStgDTO } from "../../../types/auth.type";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const register = asyncHandler(
  async (
    req: Request<{}, {}, RegisterStgDTO>,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    const { name, email, password, ph_number, avatar_url } = req.body;

    if (
      [name, email, password, ph_number].some((field) => field.trim() === "")
    ) {
      return next(new ApiError(400, "some fields are missing"));
    }

    if (!email.includes("@")) {
      return next(new ApiError(400, "not a valid email"));
    }

    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `
    INSERT INTO stg(name, email, password, ph_number) VALUES($1, $2, $3, $4, $5)
    RETURNING id, name, email, ph_number, avatar_url;
    `,
      [name, email, hashPassword, ph_number, avatar_url || null],
    );

    return res
      .status(201)
      .json(
        new ApiResponse(201, result.rows[0], "STG registered successfully"),
      );
  },
);

export const uploadAvatarToS3 = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const {
      userId,
      contentType,
      fileExtension,
    }: { userId: string; contentType: string; fileExtension: string } =
      req.body;

    const s3Client = new S3Client({ region: process.env.AWS_REGION });

    const uniqueId = crypto.randomUUID();

    const s3Key = `uploads/users/profile/${userId}/${uniqueId}.${fileExtension}`;

    try {
      const command = new PutObjectCommand({
        Bucket: process.env.BUCKET_NAME,
        Key: s3Key,
        ContentType: contentType,
      });

      const presignedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 900,
      });

      return res.status(201).json(
        new ApiResponse(
          201,
          {
            presignedUrl,
            s3Key,
          },
          "presigned url generated succcessfullly.",
        ),
      );
    } catch (error) {
      console.log(`error while uploading to S3`);
      throw error;
    }
  },
);
