import { Router } from "express";
import {
  register,
  sendOtp,
  updateAvatarUrl,
  uploadAvatarToS3,
  login,
  refreshAccessToken,
  logout,
  getCurrentUser,
  resetPassword,
} from "../../controllers/auth/users.auth.controller.js";
import { upload } from "../../middlewares/multer.middleware.js";
import { verifyJWT } from "../../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(register);
router
  .route("/upload")
  .post(verifyJWT, upload.single("profile"), uploadAvatarToS3);
router.route("/update-avatar").post(verifyJWT, updateAvatarUrl);
router.route("/send-otp").post(sendOtp);
router.route("/login").post(login);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/logout").get(verifyJWT, logout);
router.route("/current-user").get(verifyJWT, getCurrentUser);
router.route("/reset-password").patch(verifyJWT, resetPassword);

export { router as userRouter };
