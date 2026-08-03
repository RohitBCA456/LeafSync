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

const ROLE_DOC_CONFIG: Record<string, { docsChoice: string[] }> = {
  stg: {
    docsChoice: ["aadhaar", "pan"],
  },
  driver: {
    docsChoice: ["driving_license"],
  },
};

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
      `SELECT is_doc_verified FROM ${tableName} WHERE user_id = $1;`,
      [userId],
    );

    if (
      existingCheck.rows.length > 0 &&
      existingCheck.rows[0].is_doc_verified
    ) {
      return next(
        new ApiError(409, `${userRole.toUpperCase()} already verified.`),
      );
    }

    const docTypeRaw = (req.query.selectedDocType as string)?.toLowerCase(); //uses req.body but for test using req.query

    const config =
      ROLE_DOC_CONFIG[userRole.toLocaleLowerCase()] || ROLE_DOC_CONFIG.stg;

    if (!config?.docsChoice.includes(docTypeRaw) || !docTypeRaw) {
      return next(new ApiError(404, "selected docs is not supported for stg"));
    }

    const docType = docTypeRaw.toLocaleLowerCase() as VerificationDocType;
    const accessToken = await getSandboxAccessToken();

    const sessionData = await initiateDigiLockerSession(accessToken, docType);

    res.cookie("digilocker_session_id", sessionData.session_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 15 * 60 * 1000,
    });

    res.cookie(
      "digilocker_user_ctx",
      JSON.stringify({ userId, role: userRole, docType }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 15 * 60 * 1000,
        signed: true,
      },
    );

    return res.redirect(sessionData.authorization_url);
  },
);

export const handleCallback = asyncHandler(
  async (req: Request, res: Response, next: NextFunction): Promise<Response |  void> => {
    const sessionId =
      req.cookies?.digilocker_session_id || req.query.session_id;

    const userCtxRaw = req.signedCookies?.digilocker_user_ctx;

    if (!sessionId || typeof sessionId !== "string") {
      return next(
        new ApiError(400, "Session ID missing from cookies or request query."),
      );
    }

    if (!userCtxRaw) {
      return next(
        new ApiError(
          401,
          "User context missing or expired. Please restart the verification flow.",
        ),
      );
    }

    let userId: number;
    let role: role;
    let docType: VerificationDocType;

    try {
      const parsed = JSON.parse(userCtxRaw);
      userId = parsed.userId;
      role = parsed.role;
      docType = parsed.docType;
    } catch {
      return next(
        new ApiError(
          401,
          "Invalid user context. Please restart the verification flow.",
        ),
      );
    }

    if (!userId) {
      return next(
        new ApiError(
          401,
          "Invalid user context. Please restart the verification flow.",
        ),
      );
    }

    const tableName = role.toLowerCase() === "driver" ? "driver" : "stg";

    const existingCheck = await pool.query(
      `SELECT is_doc_verified FROM ${tableName} WHERE user_id = $1;`,
      [userId],
    );

    if (
      existingCheck.rows.length > 0 &&
      existingCheck.rows[0].is_doc_verified
    ) {
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
      ROLE_DOC_CONFIG[role.toLocaleLowerCase()] || ROLE_DOC_CONFIG.stg;

    if (!config?.docsChoice.includes(docType)) {
      return next(new ApiError(404, "there is docType mismatch"));
    }

    const { buffer, mimeType } = await fetchDigiLockerDocument(
      accessToken,
      sessionId,
      docType.toLowerCase(),
    );

    if (!mimeType || typeof mimeType !== "string") {
      return next(new ApiError(400, "unsupport format or mimeType is missing"));
    }

    const docTypeEnum = docType.toUpperCase();
    const s3Url = await uploadBufferToS3(userId, buffer, mimeType, docTypeEnum);

    const result = await pool.query(
      `
      INSERT INTO ${tableName} (user_id, verification_doc_type, verification_doc_url, is_doc_verified, doc_verification_status)
      VALUES ($1, $2, $3, true, 'VERIFIED')
      ON CONFLICT (user_id)
      DO UPDATE SET
          verification_doc_type = EXCLUDED.verification_doc_type,
          verification_doc_url = EXCLUDED.verification_doc_url,
          is_doc_verified = true,
          doc_verification_status = 'VERIFIED'
      RETURNING user_id, verification_doc_type, is_doc_verified, doc_verification_status;
      `,
      [userId, docTypeEnum, s3Url],
    );

    res.clearCookie("digilocker_session_id");
    res.clearCookie("digilocker_user_ctx");

    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          { dbRecord: result.rows[0], s3Url },
          "DigiLocker verification completed successfully",
        ),
      );
  },
);
