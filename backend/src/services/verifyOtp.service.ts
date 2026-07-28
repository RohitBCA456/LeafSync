import { redisClient } from "../config/redis.config";

export const verifyOtpCode = async (
  email: string,
  inputOtp: string,
): Promise<boolean> => {
  const cleanEmail = email.trim().toLowerCase();
  const redisKey = `otp:${cleanEmail}`;

  const storedOtp = await redisClient.get(redisKey);

  if (!storedOtp || storedOtp !== inputOtp.trim()) {
    return false;
  }

  await redisClient.del(redisKey);
  return true;
};
