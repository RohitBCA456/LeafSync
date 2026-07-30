import { Resend } from "resend";
import dotenv from "dotenv";
import path from "path"

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

export const resend = new Resend(process.env.RESEND_API);