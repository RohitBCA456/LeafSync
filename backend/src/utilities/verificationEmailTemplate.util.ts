export interface StatusEmailParams {
  name?: string;
  status: "VERIFIED" | "REJECTED" | "PENDING";
  docType?: string;
  reason?: string;  
}

export const getVerificationStatusHtml = ({
  name,
  status,
  docType,
  reason,
}: StatusEmailParams): { subject: string; html: string } => {
  const userName = name || "User";
  const formattedDocType = docType ? docType.toUpperCase() : "Document";

  const config = {
    VERIFIED: {
      subject: `Verification Approved - LeafSync`,
      title: "Document Verification Successful",
      badgeBg: "#e8f5e9",
      badgeColor: "#2e7d32",
      badgeText: "VERIFIED",
      message: `Great news! Your <strong>${formattedDocType}</strong> has been successfully verified. Your account is now fully active and ready to use.`,
      footerNote: "You can now log in and access all LeafSync features.",
    },
    REJECTED: {
      subject: `Verification Action Required - LeafSync`,
      title: "Document Verification Update",
      badgeBg: "#ffebee",
      badgeColor: "#c62828",
      badgeText: "REJECTED",
      message: `Unfortunately, we could not verify your <strong>${formattedDocType}</strong>.`,
      reasonBlock: reason
        ? `<div style="background-color: #f5f5f5; border-left: 4px solid #c62828; padding: 12px; margin: 15px 0; font-size: 14px; color: #555;">
             <strong>Reason:</strong> ${reason}
           </div>`
        : "",
      footerNote: "Please re-upload a clear, valid copy of your document through your account settings.",
    },
    PENDING: {
      subject: `Verification In Progress - LeafSync`,
      title: "Verification Under Review",
      badgeBg: "#fff8e1",
      badgeColor: "#f57f17",
      badgeText: "PENDING",
      message: `We have received your <strong>${formattedDocType}</strong> submission and it is currently being processed.`,
      footerNote: "This process typically takes a few minutes. We will notify you once review is complete.",
    },
  }[status];

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; color: #333;">
      <h2 style="color: #2e7d32; margin-top: 0;">LeafSync</h2>
      <h3 style="color: #444;">${config.title}</h3>
      
      <p>Hello ${userName},</p>
      
      <div style="margin: 20px 0;">
        <span style="background-color: ${config.badgeBg}; color: ${config.badgeColor}; font-weight: bold; padding: 6px 12px; border-radius: 4px; display: inline-block; font-size: 14px; letter-spacing: 1px;">
          STATUS: ${config.badgeText}
        </span>
      </div>

      <p style="font-size: 16px; line-height: 1.5;">
        ${config.message}
      </p>

      ${'reasonBlock' in config ? config.reasonBlock : ""}

      <p style="font-size: 14px; color: #666; margin-top: 25px;">
        ${config.footerNote}
      </p>

      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0 15px 0;" />
      
      <p style="font-size: 12px; color: #888; text-align: center;">
        If you have any questions, please contact our support team.<br/>
        &copy; LeafSync. All rights reserved.
      </p>
    </div>
  `;

  return { subject: config.subject, html };
};