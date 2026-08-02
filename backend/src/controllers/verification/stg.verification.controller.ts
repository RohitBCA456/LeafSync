import { ApiError } from "./../../utilities/ApiError.util.js";
import { ApiResponse } from "./../../utilities/ApiResponse.js";
import { Request, Response, NextFunction as NextFunction } from "express";
import { verifyStgDTO } from "../../types/auth.type.js";
import { asyncHandler } from "../../utilities/asyncHandler.util.js";
import { verifyStgDocument } from "../../services/detailExtraction.service.js";
import { pool } from "../../config/db.config.js";
import { uploadVerificationDocToS3 } from "../../services/uploadVerificationDocToS3.service.js";

export const stgDocVerification = asyncHandler(
  async (
    req: Request<{}, {}, verifyStgDTO>,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    const { verification_doc_type } = req.body;

    if (
      !["AADHAAR", "PAN", "VOTER_ID", "DRIVING_LICENSE"].includes(
        verification_doc_type,
      )
    ) {
      return next(
        new ApiError(400, "Invalid type for stg's document verification"),
      );
    }

    if (!verification_doc_type || !req.file?.buffer) {
      return next(
        new ApiError(400, "verification documents or type is missing"),
      );
    }

    const verification_doc: Buffer = req.file.buffer;
    const userId: number = req.user?.userId || -1;

    try {
      const existingStg = await pool.query(
        `SELECT is_doc_verified FROM stg WHERE user_id = $1`,
        [userId],
      );

      if (existingStg.rows.length > 0 && existingStg.rows[0].is_doc_verified) {
        return next(new ApiError(409, "Verification is already completed"));
      }

      const extractDetials = await verifyStgDocument(
        verification_doc,
        verification_doc_type,
      );

      if (!extractDetials.isVerified) {
        return next(new ApiError(400, "Document verification failed"));
      }

      const fileExtension =
        req.file.originalname.split(".").pop()?.toLowerCase() || "jpg";

      const docUrl = await uploadVerificationDocToS3(
        userId,
        req.file.buffer,
        req.file.mimetype,
        fileExtension,
      );

      const result = await pool.query(
        `
      INSERT INTO stg(user_id, verification_doc_type, verification_doc_url, is_doc_verified, doc_verification_status)
      VALUES ($1, $2, $3, true, 'VERIFIED')
      RETURNING user_id, verification_doc_type, is_doc_verified, doc_verification_status;
      `,
        [userId, verification_doc_type, docUrl],
      );

      const stgData = result.rows[0];

      return res
        .status(200)
        .json(
          new ApiResponse(
            200,
            { extractDetials, stgData },
            "Document verification successful",
          ),
        );
    } catch (error) {
      return next(
        new ApiError(500, "Error during document verification", error as any),
      );
    }
  },
);
