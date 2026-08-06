import { Request, Response, NextFunction } from "express";
import { ApiError } from "../../utilities/ApiError.util.js";
import { VerificationDocType } from "../../types/auth.type.js";
import { uploadBufferToS3 } from "../../services/s3Upload.service.js";
import { asyncHandler } from "../../utilities/asyncHandler.util.js";
import { pool } from "../../config/db.config.js";
import { ApiResponse } from "../../utilities/ApiResponse.js";

type VerificationDocBody = {
  docType?: VerificationDocType;
};

const MAP_ROLE_DOC: Record<string, { docChoice: string[] }> = {
  manager: {
    docChoice: ["factory_license"],
  },
};

export const uploadVerificationDoc = asyncHandler(
  async (
    req: Request<{}, {}, VerificationDocBody>,
    res: Response,
    next: NextFunction,
  ): Promise<Response | void> => {
    const userId = req.user?.userId;
    const userRole = req.user?.role;
    if (!userId) {
      return next(new ApiError(401, "User is not authenticated"));
    }

    if (userRole !== "manager") {
      return next(new ApiError(400, "not a valid role for manager"));
    }

    const existingCheck = await pool.query(
      `SELECT doc_verification_status FROM manager WHERE user_id = $1;`,
      [userId],
    );

    if (
      existingCheck.rows.length > 0 &&
      existingCheck.rows[0].doc_verification_status === "VERIFIED"
    ) {
      return next(new ApiError(409, `manager already verified.`));
    }

    const doc = req.file;
    if (!doc) {
      return next(
        new ApiError(400, "Factory document file is required for verification"),
      );
    }

    console.log(doc);

    if (doc.mimetype !== "application/pdf") {
      return next(new ApiError(400, "Only PDF format documents are allowed"));
    }

    const docType = (req.body.docType ||
      "FACTORY_LICENSE") as VerificationDocType;

    if (!docType) {
      return next(
        new ApiError(400, "Document type or valid file extension is required"),
      );
    }

    const config = MAP_ROLE_DOC[userRole];

    console.log(config);

    console.log(docType.toLocaleLowerCase());

    if (!config?.docChoice.includes(docType.toLocaleLowerCase())) {
      return next(new ApiError(400, "not a valid docType for manager"));
    }

    const fileUrl = await uploadBufferToS3(
      userId,
      doc.buffer,
      doc.mimetype,
      docType,
    );

    const dbQuery = await pool.query(
      `
      INSERT INTO manager (user_id, factory_verification)
      VALUES ($1, $2)
      ON CONFLICT (user_id)
      DO UPDATE SET 
      factory_verification = EXCLUDED.factory_verification, 
      doc_verification_status = 'VERIFIED',
      updated_at = NOW()
      RETURNING doc_verification_status, factory_verification;
      `,
      [userId, fileUrl],
    );

    const manager = dbQuery.rows[0];

    if (!manager) {
      return next(new ApiError(404, "Manager record could not be updated"));
    }

    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          manager,
          "Document uploaded successfully for verification by the admin",
        ),
      );
  },
);
