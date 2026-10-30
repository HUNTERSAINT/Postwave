import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { HttpError } from "@/lib/http";

const MAX_MEDIA_BYTES = 100 * 1024 * 1024;
const ALLOWED_MEDIA = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
  ["video/mp4", ".mp4"],
  ["video/quicktime", ".mov"],
  ["video/webm", ".webm"],
]);

type StorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  publicBaseUrl: string;
};

type S3Globals = typeof globalThis & {
  __postwaveS3?: S3Client;
};
const globals = globalThis as S3Globals;

function storageConfig(): StorageConfig {
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION;
  const bucket = process.env.S3_BUCKET;
  const publicBaseUrl = process.env.S3_PUBLIC_BASE_URL;
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  if (
    !endpoint ||
    !region ||
    !bucket ||
    !publicBaseUrl ||
    !accessKeyId ||
    !secretAccessKey
  ) {
    throw new HttpError(503, "Media storage is not configured.");
  }
  return { endpoint, region, bucket, publicBaseUrl };
}

function getS3Client(config: StorageConfig) {
  return (
    globals.__postwaveS3 ??
    (globals.__postwaveS3 = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
    }))
  );
}

function publicObjectUrl(baseUrl: string, key: string) {
  const suffix = key.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl.replace(/\/+$/, "")}/${suffix}`;
}

export function validateUploadMetadata(contentType: string, size: number) {
  if (!ALLOWED_MEDIA.has(contentType)) {
    throw new HttpError(
      400,
      "Choose a JPEG, PNG, WebP, GIF, MP4, MOV, or WebM file.",
    );
  }
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_MEDIA_BYTES) {
    throw new HttpError(413, "Each media file must be smaller than 100 MB.");
  }
}

export async function createUploadUrl(
  userId: string,
  contentType: string,
  size: number,
) {
  validateUploadMetadata(contentType, size);
  const config = storageConfig();
  const client = getS3Client(config);
  const extension = ALLOWED_MEDIA.get(contentType);
  if (!extension) throw new HttpError(400, "This file type is not supported.");
  const key = `${userId}/media/${randomUUID()}${extension}`;
  const ownerMetadata = userId;
  const command = new PutObjectCommand({
    Bucket: config.bucket,
    Key: key,
    ContentType: contentType,
    ContentLength: size,
    Metadata: { postwaveuserid: ownerMetadata },
  });
  const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
  return {
    uploadUrl,
    key,
    publicUrl: publicObjectUrl(config.publicBaseUrl, key),
    headers: {
      "Content-Type": contentType,
      "x-amz-meta-postwaveuserid": ownerMetadata,
    },
  };
}

function validFileSignature(contentType: string, bytes: Uint8Array) {
  const ascii = (start: number, length: number) =>
    Buffer.from(bytes.slice(start, start + length)).toString("ascii");
  if (contentType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === "image/png") {
    return (
      bytes[0] === 0x89 &&
      ascii(1, 3) === "PNG" &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  if (contentType === "image/webp") {
    return ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP";
  }
  if (contentType === "image/gif") {
    return ascii(0, 6) === "GIF87a" || ascii(0, 6) === "GIF89a";
  }
  if (contentType === "video/mp4" || contentType === "video/quicktime") {
    return ascii(4, 4) === "ftyp";
  }
  if (contentType === "video/webm") {
    return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
  }
  return false;
}

export async function verifyUploadedObject(
  userId: string,
  key: string,
) {
  if (!key.startsWith(`${userId}/media/`)) {
    throw new HttpError(400, "This upload does not belong to your account.");
  }
  const config = storageConfig();
  const client = getS3Client(config);
  const head = await client.send(
    new HeadObjectCommand({ Bucket: config.bucket, Key: key }),
  );
  const contentType = head.ContentType ?? "";
  if (
    head.Metadata?.postwaveuserid !== userId ||
    !ALLOWED_MEDIA.has(contentType) ||
    !head.ContentLength ||
    head.ContentLength > MAX_MEDIA_BYTES
  ) {
    throw new HttpError(400, "The uploaded media did not pass validation.");
  }

  const response = await client.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Range: "bytes=0-31",
    }),
  );
  const bytes = await response.Body?.transformToByteArray();
  if (!bytes || !validFileSignature(contentType, bytes)) {
    await client.send(
      new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
    );
    throw new HttpError(400, "The file content does not match its declared type.");
  }

  return {
    publicUrl: publicObjectUrl(config.publicBaseUrl, key),
    contentType,
    size: head.ContentLength,
  };
}

export async function deleteUploadedObject(userId: string, key: string) {
  if (!key.startsWith(`${userId}/media/`)) return;
  const config = storageConfig();
  await getS3Client(config).send(
    new DeleteObjectCommand({ Bucket: config.bucket, Key: key }),
  );
}
