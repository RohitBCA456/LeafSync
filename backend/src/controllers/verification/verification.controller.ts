import { Request, Response, NextFunction } from "express";
import {
  getSandboxAccessToken,
  initiateDigiLockerSession,
  getSessionStatus,
  fetchDigiLockerDocument,
} from "../../services/sandbox.service.js";
import { asyncHandler } from "../../utilities/asyncHandler.util.js";
import { ApiError } from "../../utilities/ApiError.util.js";
import { uploadBufferToS3 } from "../../services/s3Upload.service.js";
import { pool } from "../../config/db.config.js";
import { ApiResponse } from "../../utilities/ApiResponse.js";
import { role, VerificationDocType } from "../../types/auth.type.js";
import { redisClient } from "../../config/redis.config.js";
import { sendVerificationStatusEmail } from "../../services/verificationStatusEmail.service.js";

const ROLE_DOC_CONFIG: Record<string, { docsChoice: string[] }> = {
  stg: {
    docsChoice: ["aadhaar", "pan"],
  },
  driver: {
    docsChoice: ["driving_license"],
  },
};

const SESSION_TTL = 15 * 60;

export const initiateAuth = asyncHandler(
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    const userRole = req.user?.role as role;
    const userId = req.user!.userId;

    const tableName = userRole.toLowerCase() === "driver" ? "driver" : "stg";

    const existingCheck = await pool.query(
      `SELECT doc_verification_status FROM ${tableName} WHERE user_id = $1;`,
      [userId],
    );

    if (
      existingCheck.rows.length > 0 &&
      existingCheck.rows[0].doc_verification_status === 'VERIFIED'
    ) {
      return next(
        new ApiError(409, `${userRole.toUpperCase()} already verified.`),
      );
    }

    const docTypeRaw = (req.query.selectedDocType as string)?.toLowerCase();

    const config =
      ROLE_DOC_CONFIG[userRole.toLowerCase()] || ROLE_DOC_CONFIG.stg;

    if (!docTypeRaw || !config?.docsChoice.includes(docTypeRaw)) {
      return next(
        new ApiError(
          400,
          `Selected document is not supported for role: ${userRole}`,
        ),
      );
    }

    const docType = docTypeRaw.toLowerCase() as VerificationDocType;
    const accessToken = await getSandboxAccessToken();

    const sessionData = await initiateDigiLockerSession(accessToken, docType);
    const sessionId = sessionData.session_id;

    const redisKey = `digilocker_session:${sessionId}`;
    const sessionPayload = JSON.stringify({
      userId,
      role: userRole,
      docType,
    });

    await redisClient.setEx(redisKey, SESSION_TTL, sessionPayload);

    res.cookie("digilocker_session_id", sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: SESSION_TTL * 1000,
    });

    return res.redirect(sessionData.authorization_url);
  },
);

export const handleCallback = asyncHandler(
  async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    const sessionId =
      (req.query.session_id as string) ||
      (req.query.state as string) ||
      req.cookies?.digilocker_session_id;

    if (!sessionId || typeof sessionId !== "string") {
      return next(
        new ApiError(400, "Session ID or state missing from callback request."),
      );
    }

    const redisKey = `digilocker_session:${sessionId}`;
    const cachedContext = await redisClient.get(redisKey);

    let userId: number;
    let userRole: role;
    let docType: VerificationDocType;

    if (cachedContext) {
      try {
        const parsed = JSON.parse(cachedContext);
        userId = parsed.userId;
        userRole = parsed.role;
        docType = parsed.docType;
      } catch {
        return next(new ApiError(401, "Corrupted session context in cache."));
      }
    } else {
      return next(
        new ApiError(
          401,
          "Verification session expired or invalid. Please restart the process.",
        ),
      );
    }

    const tableName = userRole.toLowerCase() === "driver" ? "driver" : "stg";

    const existingCheck = await pool.query(
      `SELECT doc_verification_status FROM ${tableName} WHERE user_id = $1;`,
      [userId],
    );

    if (
      existingCheck.rows.length > 0 &&
      existingCheck.rows[0].doc_verification_status === 'VERIFIED'
    ) {
      await redisClient.del(redisKey);
      return next(
        new ApiError(409, `${tableName.toUpperCase()} already verified.`),
      );
    }

    const accessToken = await getSandboxAccessToken();
    const statusData = await getSessionStatus(accessToken, sessionId);

    if (statusData.status !== "succeeded" && statusData.status !== "SUCCESS") {
      return next(
        new ApiError(
          400,
          `DigiLocker consent not completed. Current status: ${statusData.status}`,
        ),
      );
    }

    const config =
      ROLE_DOC_CONFIG[userRole.toLowerCase()] || ROLE_DOC_CONFIG.stg;

    if (!config?.docsChoice.includes(docType)) {
      await redisClient.del(redisKey);
      return next(
        new ApiError(400, "Document type mismatch for role configuration."),
      );
    }

    const { buffer, mimeType } = await fetchDigiLockerDocument(
      accessToken,
      sessionId,
      docType,
    );

    if (!mimeType || typeof mimeType !== "string") {
      return next(
        new ApiError(400, "Unsupported format or MIME type is missing."),
      );
    }

    const docTypeEnum = docType.toUpperCase() as VerificationDocType;
    const s3Url = await uploadBufferToS3(userId, buffer, mimeType, docTypeEnum);

    const result = await pool.query(
      `
      WITH updated AS (
        INSERT INTO ${tableName} (
          user_id, 
          verification_doc_type, 
          verification_doc_url, 
          doc_verification_status
        )
        VALUES ($1, $2, $3, true, 'VERIFIED')
        ON CONFLICT (user_id)
        DO UPDATE SET
            verification_doc_type = EXCLUDED.verification_doc_type,
            verification_doc_url = EXCLUDED.verification_doc_url,
            doc_verification_status = 'VERIFIED',
            updated_at = NOW()
        RETURNING user_id, verification_doc_type, doc_verification_status
      )
      SELECT u.email, u.name, upd.*
      FROM updated upd
      JOIN users u ON u.user_id = upd.user_id;
      `,
      [userId, docTypeEnum, s3Url],
    );

    await redisClient.del(redisKey);

    res.clearCookie("digilocker_session_id", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    const record = result.rows[0];

    if (record?.email) {
      sendVerificationStatusEmail(record.email, {
        name: record.name,
        status: record.doc_verification_status,
        docType: docType,
      }).catch((error) =>
        console.log(`failed to send verification email`, error),
      );
    }

    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          { dbRecord: result.rows[0], s3Url },
          "DigiLocker verification completed successfully.",
        ),
      );
  },
);
