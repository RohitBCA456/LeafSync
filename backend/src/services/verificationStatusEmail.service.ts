import { CreateEmailResponse } from "resend";
import { resend } from "../config/resend.config.js";
import {
  getVerificationStatusHtml,
  StatusEmailParams,
} from "../utilities/verificationEmailTemplate.util.js";

export async function sendVerificationStatusEmail(
  email: string,
  params: StatusEmailParams,
): Promise<CreateEmailResponse> {
  const cleanEmail = email.trim().toLocaleLowerCase();

  const { subject, html } = getVerificationStatusHtml(params);

  try {
    const data = await resend.emails.send({
      from: "LeafSync <onboarding@resend.dev>",
      to: [cleanEmail],
      subject,
      html,
    });

    return data;
  } catch (error) {
    console.log(`error while sending verification status email`, error);
    throw error;
  }
}
