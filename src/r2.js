import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function client() {
  return new S3Client({
    region: "auto",
    endpoint: required("R2_ENDPOINT"),
    credentials: {
      accessKeyId: required("R2_ACCESS_KEY_ID"),
      secretAccessKey: required("R2_SECRET_ACCESS_KEY"),
    },
  });
}

export async function uploadImage(key, body) {
  const Bucket = required("R2_BUCKET");
  await client().send(new PutObjectCommand({
    Bucket,
    Key: key,
    Body: body,
    ContentType: "image/jpeg",
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return `${required("R2_PUBLIC_BASE_URL").replace(/\/$/, "")}/${key}`;
}

export async function assertObject(key) {
  await client().send(new HeadObjectCommand({
    Bucket: required("R2_BUCKET"),
    Key: key,
  }));
}
