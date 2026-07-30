import { Router } from "express";
import {
  register,
  sendOtp,
  updateAvatarUrl,
  uploadAvatarToS3,
} from "../controllers/auth/users.auth.controller.js";
import { upload } from "../middlewares/multer.middleware.js";

const router = Router();

router.route("/register").post(register);
router.route("/upload").post(upload.single("profile"), uploadAvatarToS3);
router.route("/update-avatar").post(updateAvatarUrl);
router.route("/send-otp").post(sendOtp);

export { router as stgRouter };
