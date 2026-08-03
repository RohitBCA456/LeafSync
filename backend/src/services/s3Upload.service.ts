import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
});

export const uploadBufferToS3 = async (
  userId: number,
  fileBuffer: Buffer,
  mimeType: string,
  docType: string,
): Promise<string> => {
  const ext = mimeType.includes("xml") ? "xml" : "pdf";
  const uniqueKey = `uploads/digilocker/${userId}/${docType.toLowerCase()}_${crypto.randomUUID()}.${ext}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: process.env.BUCKET_NAME,
      Key: uniqueKey,
      Body: fileBuffer,
      ContentType: mimeType,
    }),
  );

  return `https://${process.env.BUCKET_NAME}.s3.${
    process.env.AWS_REGION || "ap-south-1"
  }.amazonaws.com/${uniqueKey}`;
};
