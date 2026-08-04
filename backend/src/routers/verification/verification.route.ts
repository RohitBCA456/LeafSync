import { Router } from "express";
import {
  initiateAuth,
  handleCallback,
} from "../../controllers/verification/verification.controller.js";
import { verifyJWT } from "../../middlewares/auth.middleware.js";

const router = Router();

router.get("/digilocker/auth", verifyJWT, initiateAuth);
router.get("/digilocker/callback", handleCallback);

export { router as verificationRouter };
