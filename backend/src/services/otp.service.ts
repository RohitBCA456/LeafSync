import crypto from "crypto";
import { redisClient } from "../config/redis.config.js";
import { resend } from "../config/resend.config.js";

const OTP_EXPIRY_SECONDS = 600;

function generateOtp(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export const sendOtpEmail = async (email: string): Promise<boolean> => {
  const cleanEmail = email.trim().toLowerCase();
  const redisKey = `otp:${cleanEmail}`;

  const otp = generateOtp();

  try {
    await redisClient.set(redisKey, otp, { EX: OTP_EXPIRY_SECONDS });

    const { error } = await resend.emails.send({
      from: "LeafSync <onboarding@resend.dev>",
      to: [cleanEmail],
      subject: "Your Registration Verification Code",
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2>Verify Your Email</h2>
          <p>Your 6-digit OTP code for LeafSync registration is:</p>
          <h1 style="font-size: 32px; letter-spacing: 5px; color: #2e7d32;">${otp}</h1>
          <p>This code will expire in <strong>10 minutes</strong>.</p>
          <p>If you did not request this code, please ignore this email.</p>
        </div>
      `,
    });

    if (error) {
      console.error("Error while sending OTP email via Resend:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error in sendOtpEmail service:", error);
    return false;
  }
};