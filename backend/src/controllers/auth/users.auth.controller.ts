import { Request, Response, NextFunction } from "express";
import { ApiError } from "../../utilities/ApiError.util.js";
import bcrypt from "bcrypt";
import { pool } from "../../config/db.config.js";
import { ApiResponse } from "../../utilities/ApiResponse.js";
import { asyncHandler } from "../../utilities/asyncHandler.util.js";
import { BaseRegisterDTO, role } from "../../types/auth.type.js";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { sendOtpEmail } from "../../services/otp.service.js";
import { verifyOtpCode } from "../../services/verifyOtp.service.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../../utilities/token.util.js";
import { redisClient } from "../../config/redis.config.js";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
});

const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
const BCRYPT_SALT_ROUNDS = 10;

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: (process.env.NODE_ENV === "production" ? "none" : "lax") as
    | "none"
    | "lax",
  path: "/",
  signed: true,
  maxAge: SESSION_TTL_SECONDS * 1000,
};

export const register = asyncHandler(
  async (
    req: Request<{}, {}, BaseRegisterDTO>,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    const {
      name,
      email,
      password,
      ph_number,
      latitude,
      longitude,
      otp,
      role: userRole,
    } = req.body;

    if (
      [name, email, password, ph_number, otp, userRole].some(
        (field) => !field || field.trim() === "",
      )
    ) {
      return next(new ApiError(400, "Some required fields are missing"));
    }

    if (!email.includes("@")) {
      return next(new ApiError(400, "Invalid email address format"));
    }

    const normalizedRole = userRole.toLowerCase();
    const allowedRoles = ["stg", "driver", "manager"];

    if (!allowedRoles.includes(normalizedRole)) {
      return next(
        new ApiError(
          400,
          `Invalid role. Allowed roles: ${allowedRoles.join(", ")}`,
        ),
      );
    }

    const existingUserQuery = await pool.query(
      `SELECT user_id, email, ph_number FROM users WHERE email = $1 OR ph_number = $2;`,
      [email.toLowerCase(), ph_number],
    );

    if (existingUserQuery.rows.length > 0) {
      return next(
        new ApiError(
          409,
          "User already exists with this email or phone number. Please login instead.",
        ),
      );
    }

    const isOtpValid = await verifyOtpCode(email, otp);
    if (!isOtpValid) {
      return next(new ApiError(400, "Invalid or expired OTP code"));
    }

    const hashPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

    const result = await pool.query(
      `
      INSERT INTO users (
        name, 
        email, 
        password, 
        ph_number, 
        location,
        role,
        is_email_verified
      ) 
      VALUES ($1, $2, $3, $4, ST_SetSRID(ST_MakePoint($5, $6), 4326), $7, TRUE)
      RETURNING 
        user_id, 
        name, 
        email, 
        ph_number, 
        ST_Y(location::geometry) AS latitude, 
        ST_X(location::geometry) AS longitude,
        role;
      `,
      [
        name,
        email,
        hashPassword,
        ph_number,
        longitude,
        latitude,
        normalizedRole,
      ],
    );

    const user = result.rows[0];

    const tokenPayload = { userId: user.user_id, role: user.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    const hashedRefreshToken = await bcrypt.hash(
      refreshToken,
      BCRYPT_SALT_ROUNDS,
    );
    await pool.query(
      `UPDATE users SET refresh_token = $1, updated_at = NOW() WHERE user_id = $2;`,
      [hashedRefreshToken, user.user_id],
    );

    const key = `user_session:${user.user_id}`;
    const redisPayload = JSON.stringify({
      userId: user.user_id,
      role: user.role,
      refresh_token: hashedRefreshToken,
    });

    await redisClient.setEx(key, SESSION_TTL_SECONDS, redisPayload);

    res.cookie("refreshToken", refreshToken, COOKIE_OPTIONS);
    res.cookie("accessToken", accessToken, COOKIE_OPTIONS);

    return res
      .status(201)
      .json(
        new ApiResponse(201, { user, accessToken }, "Registered successfully"),
      );
  },
);

export const uploadAvatarToS3 = asyncHandler(
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    if (!req.user) {
      return next(new ApiError(401, "Unauthorized access"));
    }
    const { userId }: { userId: number } = req.user;
    const profile = req.file;

    if (!profile) {
      return next(new ApiError(400, "Profile image file is required"));
    }

    const contentType = profile.mimetype;
    const fileExtension =
      profile.originalname.split(".").pop()?.toLowerCase() || "png";
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
          "Presigned URL generated successfully",
        ),
      );
    } catch (error) {
      return next(
        new ApiError(500, "Error while uploading profile to S3", error as any),
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
    if (!req.user) {
      return next(new ApiError(401, "Unauthorized access"));
    }

    const { fileUrl }: { fileUrl: string } = req.body;
    const { userId }: { userId: number } = req.user;

    if (!fileUrl) {
      return next(new ApiError(400, "File URL is required"));
    }

    try {
      const result = await pool.query(
        `
        UPDATE users 
        SET avatar_url = $1,
        updated_at = NOW()
        WHERE user_id = $2
        RETURNING user_id, avatar_url; 
        `,
        [fileUrl, userId],
      );

      return res
        .status(200)
        .json(
          new ApiResponse(200, result.rows[0], "Updated avatar successfully"),
        );
    } catch (error) {
      return next(
        new ApiError(500, "Error while updating avatar URL", error as any),
      );
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

export const refreshAccessToken = asyncHandler(
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    const refreshToken =
      req.signedCookies?.refreshToken ||
      req.cookies?.refreshToken ||
      req.body?.refreshToken;

    if (!refreshToken) {
      return next(new ApiError(401, "Refresh token is missing"));
    }

    try {
      const decoded = verifyRefreshToken(refreshToken);
      const key = `user_session:${decoded.userId}`;
      const cacheSession = await redisClient.get(key);

      let user: {
        user_id: number;
        role: role;
        refresh_token: string;
      } | null = null;

      if (cacheSession) {
        const cachedSession = JSON.parse(cacheSession) as {
          userId: number;
          role: role;
          refresh_token: string;
        };

        user = {
          user_id: cachedSession.userId,
          role: cachedSession.role,
          refresh_token: cachedSession.refresh_token,
        };
      } else {
        const userRes = await pool.query(
          `SELECT user_id, role, refresh_token FROM users WHERE user_id = $1;`,
          [decoded.userId],
        );

        user = userRes.rows[0];

        if (!user || !user.refresh_token) {
          return next(new ApiError(403, "Invalid refresh token"));
        }

        const redisPayload = JSON.stringify({
          userId: user.user_id,
          role: user.role,
          refresh_token: user.refresh_token,
        });
        await redisClient.setEx(key, SESSION_TTL_SECONDS, redisPayload);
      }

      if (!user || !user.refresh_token) {
        return next(new ApiError(403, "Invalid or expired session"));
      }

      const isMatched = await bcrypt.compare(refreshToken, user.refresh_token);
      if (!isMatched) {
        return next(new ApiError(403, "Invalid or reused refresh token"));
      }

      const newAccessToken = generateAccessToken({
        userId: user.user_id,
        role: user.role,
      });

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { accessToken: newAccessToken },
            "Token refreshed successfully",
          ),
        );
    } catch (error) {
      return next(new ApiError(401, "Invalid or expired refresh token"));
    }
  },
);

export const login = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    const { email, password }: { email: string; password: string } = req.body;

    if (!email || !password) {
      return next(new ApiError(400, "Email and password are required"));
    }

    const userRes = await pool.query(
      `
      SELECT user_id, refresh_token, role, password FROM users WHERE email = $1;
      `,
      [email],
    );

    const user = userRes.rows[0];

    if (!user) {
      return next(new ApiError(401, "Invalid email or password"));
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return next(new ApiError(401, "Invalid email or password"));
    }

    const tokenPayload = { userId: user.user_id, role: user.role };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    const hashedRefreshToken = await bcrypt.hash(
      refreshToken,
      BCRYPT_SALT_ROUNDS,
    );
    await pool.query(
      `UPDATE users SET refresh_token = $1, updated_at = NOW() WHERE user_id = $2;`,
      [hashedRefreshToken, user.user_id],
    );

    const key = `user_session:${user.user_id}`;
    const redisPayload: string = JSON.stringify({
      userId: user.user_id,
      role: user.role,
      refresh_token: hashedRefreshToken,
    });

    await redisClient.setEx(key, SESSION_TTL_SECONDS, redisPayload);

    res.cookie("refreshToken", refreshToken, COOKIE_OPTIONS);
    res.cookie("accessToken", accessToken, COOKIE_OPTIONS);

    delete user.password;
    delete user.refresh_token;

    return res
      .status(200)
      .json(new ApiResponse(200, { user, accessToken }, "Login successful"));
  },
);

export const logout = asyncHandler(
  async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, "Unauthorized"));
    }
    const { userId }: { userId: number } = req.user;

    await pool.query(
      `UPDATE users SET refresh_token = NULL, updated_at = NOW() WHERE user_id = $1;`,
      [userId],
    );

    const key = `user_session:${userId}`;
    await redisClient.del(key);

    const clearOptions = {
      httpOnly: COOKIE_OPTIONS.httpOnly,
      secure: COOKIE_OPTIONS.secure,
      sameSite: COOKIE_OPTIONS.sameSite,
      path: COOKIE_OPTIONS.path,
      signed: COOKIE_OPTIONS.signed,
    };

    res.clearCookie("refreshToken", clearOptions);
    res.clearCookie("accessToken", clearOptions);

    return res
      .status(200)
      .json(new ApiResponse(200, null, "Logout successful"));
  },
);

type UserData = {
  name: string;
  email: string;
  role: role;
};

export const getCurrentUser = asyncHandler(
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    if (!req.user?.userId) {
      return next(new ApiError(401, "Unauthorized access"));
    }

    const userId = req.user.userId;
    const redisKey = `user_data:${userId}`;

    let user: UserData | null = null;

    const cacheData = await redisClient.get(redisKey);

    if (cacheData) {
      try {
        user = JSON.parse(cacheData) as UserData;
      } catch (error) {
        user = null;
      }
    }

    if (!user) {
      const result = await pool.query(
        `SELECT name, email, role FROM users WHERE user_id = $1;`,
        [userId],
      );

      const dbUser = result.rows[0];

      if (!dbUser) {
        return next(new ApiError(404, "User profile not found"));
      }

      user = {
        name: dbUser.name,
        email: dbUser.email,
        role: dbUser.role,
      };

      await redisClient.setEx(redisKey, 3600, JSON.stringify(user));
    }

    return res
      .status(200)
      .json(new ApiResponse(200, user, "User profile fetched successfully"));
  },
);

export const resetPassword = asyncHandler(
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    let userId = req.user?.userId;

    if (!userId) {
      return next(new ApiError(401, "user is not authenticated"));
    }

    const {
      currentPassword,
      newPassword,
    }: { currentPassword: string; newPassword: string } = req.body;

    const dbRecord = await pool.query(
      `
      SELECT password FROM users WHERE user_id = $1;
      `,
      [userId],
    );

    const user = dbRecord.rows[0];

    if (!user) {
      return next(new ApiError(404, "user not found"));
    }

    const isPasswordValid = await bcrypt.compare(
      currentPassword,
      user?.password,
    );

    if (!isPasswordValid) {
      return next(new ApiError(400, "invalid password"));
    }

    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);

    try {
      await pool.query(
        `
        UPDATE users SET password = $1, 
        refresh_token = NULL,
        updated_at = NOW()
        WHERE user_id = $2;
        `,
        [hashedPassword, userId],
      );
    } catch (error) {
      return next(
        new ApiError(500, "error while updating password", error as any),
      );
    }

    return res
      .status(200)
      .json(new ApiResponse(200, "password reset successfully"));
  },
);
