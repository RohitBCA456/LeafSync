import { Request, Response, NextFunction } from "express";
import { ApiError } from "../../utilities/ApiError.util";
import bcrypt from "bcrypt";
import { pool } from "../../config/db.config";
import { ApiResponse } from "../../utilities/ApiResponse";
import { asyncHandler } from "../../utilities/asyncHandler.util";
import { RegisterStgDTO } from "../../../types/auth.type";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { sendOtpEmail } from "../../services/otp.service";
import { verifyOtpCode } from "../../services/verifyOtp.service";

let s3Client = new S3Client({ region: process.env.AWS_REGION });

export const register = asyncHandler(
  async (
    req: Request<{}, {}, RegisterStgDTO>,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    const { name, email, password, ph_number, latitude, longitude, otp } =
      req.body;

    if (
      [name, email, password, ph_number, otp].some(
        (field) => field.trim() === "",
      )
    ) {
      return next(new ApiError(400, "some fields are missing"));
    }

    if (!email.includes("@")) {
      return next(new ApiError(400, "not a valid email"));
    }

    const isOtpValid = await verifyOtpCode(email, otp);
    if (!isOtpValid) {
      return next(new ApiError(400, "Invalid or expired OTP code"));
    }

    const salt = await bcrypt.genSalt(10);
    const hashPassword = await bcrypt.hash(password, salt);

    const result = await pool.query(
      `
      INSERT INTO stg (
        name, 
        email, 
        password, 
        ph_number, 
        location,
        is_email_verified
      ) 
      VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), TRUE)
      RETURNING 
        stg_id, 
        name, 
        email, 
        ph_number, 
        ST_Y(location::geometry) AS latitude, 
        ST_X(location::geometry) AS longitude;
      `,
      [name, email, hashPassword, ph_number, longitude, latitude],
    );

    return res
      .status(201)
      .json(
        new ApiResponse(201, result.rows[0], "STG registered successfully"),
      );
  },
);

export const uploadAvatarToS3 = asyncHandler(
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    const {
      userId,
      contentType,
      fileExtension,
    }: { userId: string; contentType: string; fileExtension: string } =
      req.body;

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
      next(
        new ApiError(500, "error while uploading profile to s3", error as any),
      );
    }
  },
);

export const updateAvatarUrl = asyncHandler(
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    const { fileUrl, userId }: { fileUrl: string; userId: number } = req.body;

    try {
      const result = await pool.query(
        `
        UPDATE stg 
        SET avatar_url = $1
        WHERE stg_id = $2
        RETURNING stg_id, avatar_url; 
        `,
        [fileUrl, userId],
      );

      return res
        .status(200)
        .json(
          new ApiResponse(200, result.rows[0], "update avatar successfully"),
        );
    } catch (error) {
      console.log(`error while updating avatar url`, error);
      next(new ApiError(500, "error  while updating avatar url", error as any));
    }
  },
);

export const sendOtp = asyncHandler(
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    const { email } = req.body;

    if (!email || !email.includes("@")) {
      return next(new ApiError(400, "Please provide a valid email address"));
    }

    const isSent = await sendOtpEmail(email);

    if (!isSent) {
      return next(
        new ApiError(500, "Failed to send OTP email. Please try again."),
      );
    }

    return res
      .status(200)
      .json(new ApiResponse(200, null, "OTP code sent successfully"));
  },
);
