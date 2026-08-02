import { Router } from "express";
import { stgDocVerification } from "../controllers/verification/stg.verification.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router
  .route("/verify-doc")
  .post(verifyJWT, upload.single("verification_doc"), stgDocVerification);

export { router as stgVerificationRouter };
