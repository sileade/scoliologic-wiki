// S3/MinIO Storage helpers for self-hosted deployment
// Используется вместо Manus storage proxy при развёртывании на своём сервере

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

interface S3Config {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region: string;
  publicUrl?: string;
}

function getS3Config(): S3Config {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKeyId = process.env.S3_ACCESS_KEY;
  const secretAccessKey = process.env.S3_SECRET_KEY;
  const bucket = process.env.S3_BUCKET || 'scoliologic-wiki';
  const region = process.env.S3_REGION || 'us-east-1';
  const publicUrl = process.env.S3_PUBLIC_URL;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'S3 credentials missing: set S3_ENDPOINT, S3_ACCESS_KEY, and S3_SECRET_KEY'
    );
  }

  return { endpoint, accessKeyId, secretAccessKey, bucket, region, publicUrl };
}

function createS3Client(config: S3Config): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
    forcePathStyle: true, // Required for MinIO
  });
}

function normalizeKey(relKey: string): string {
  return relKey.replace(/^\/+/, '');
}

/**
 * Upload file to S3/MinIO
 */
export async function storagePutS3(
  relKey: string,
  data: Buffer | Uint8Array | string,
  contentType = 'application/octet-stream'
): Promise<{ key: string; url: string }> {
  const config = getS3Config();
  const client = createS3Client(config);
  const key = normalizeKey(relKey);

  const body = typeof data === 'string' ? Buffer.from(data) : data;

  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
      ACL: 'public-read',
    })
  );

  // Build public URL
  const url = config.publicUrl
    ? `${config.publicUrl.replace(/\/+$/, '')}/${config.bucket}/${key}`
    : `${config.endpoint}/${config.bucket}/${key}`;

  return { key, url };
}

/**
 * Get presigned URL for file download
 */
export async function storageGetS3(
  relKey: string,
  expiresIn = 3600
): Promise<{ key: string; url: string }> {
  const config = getS3Config();
  const client = createS3Client(config);
  const key = normalizeKey(relKey);

  const command = new GetObjectCommand({
    Bucket: config.bucket,
    Key: key,
  });

  const url = await getSignedUrl(client, command, { expiresIn });

  return { key, url };
}

/**
 * Get direct public URL (for public buckets)
 */
export function storagePublicUrl(relKey: string): string {
  const config = getS3Config();
  const key = normalizeKey(relKey);

  return config.publicUrl
    ? `${config.publicUrl.replace(/\/+$/, '')}/${config.bucket}/${key}`
    : `${config.endpoint}/${config.bucket}/${key}`;
}

// Export unified interface
export const storagePut = storagePutS3;
export const storageGet = storageGetS3;
