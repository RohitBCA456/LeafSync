import { Router } from "express";
import { upload } from "../../middlewares/multer.middleware.js";
import { verifyJWT } from "../../middlewares/auth.middleware.js";
import { uploadVerificationDoc } from "../../controllers/verification/manager.verification.controller.js";

const router = Router();

router
  .route("/verify-manager")
  .post(upload.single("doc"), verifyJWT, uploadVerificationDoc);

export { router as managerVerificationRouter };
