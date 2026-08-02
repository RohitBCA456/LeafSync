import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-south-1",
});

export async function uploadVerificationDocToS3(
  userId: number,
  fileBuffer: Buffer, 
  mimeType: string,
  extension: string,
) {
  const uniqueId = crypto.randomUUID();
  const s3Key = `uploads/stg/${userId}/${uniqueId}.${extension}`;
  const fileUrl = `https://${process.env.BUCKET_NAME}.s3.${process.env.AWS_REGION || "ap-south-1"}.amazonaws.com/${s3Key}`;

  const command = new PutObjectCommand({
    Bucket: process.env.BUCKET_NAME,
    Key: s3Key,
    Body: fileBuffer, 
    ContentType: mimeType,
  });

  await s3Client.send(command);
  return fileUrl;
}