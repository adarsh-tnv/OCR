import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { extname } from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";

const s3 = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY
  }
});

const safeName = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);

export interface StoredObject {
  bucket: string;
  key: string;
}

export class S3StorageService {
  async uploadCertificate(file: Express.Multer.File): Promise<StoredObject> {
    const now = new Date();
    const key = [
      "certificates",
      String(now.getUTCFullYear()),
      String(now.getUTCMonth() + 1).padStart(2, "0"),
      `${randomUUID()}-${safeName(file.originalname || `upload${extname(file.originalname)}`)}`
    ].join("/");

    await s3.send(
      new PutObjectCommand({
        Bucket: env.AWS_S3_BUCKET,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        Metadata: {
          originalName: file.originalname
        }
      })
    );

    return {
      bucket: env.AWS_S3_BUCKET,
      key
    };
  }

  async getSignedPreviewUrl(bucket: string, key: string) {
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    const url = await getSignedUrl(s3, command, {
      expiresIn: env.AWS_S3_SIGNED_URL_TTL_SECONDS
    });

    return {
      url,
      expiresAt: new Date(Date.now() + env.AWS_S3_SIGNED_URL_TTL_SECONDS * 1000).toISOString()
    };
  }

  async download(bucket: string, key: string): Promise<Buffer> {
    const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  async delete(bucket: string, key: string) {
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  }
}

export const s3StorageService = new S3StorageService();
