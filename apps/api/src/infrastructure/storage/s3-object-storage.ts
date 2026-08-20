import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import type { ObjectStorage } from "../../application/ports/object-storage.js";

export interface S3ObjectStorageConfig {
  readonly endpoint: string;
  readonly region: string;
  readonly bucket: string;
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
}

export function objectStorageConfigFromEnvironment(): S3ObjectStorageConfig {
  const required = (name: string): string => {
    const value = process.env[name];
    if (!value) throw new Error(`${name} is required.`);
    return value;
  };
  return {
    endpoint: required("OBJECT_STORAGE_ENDPOINT"),
    region: process.env.OBJECT_STORAGE_REGION ?? "us-east-1",
    bucket: required("OBJECT_STORAGE_BUCKET"),
    accessKeyId: required("OBJECT_STORAGE_ACCESS_KEY"),
    secretAccessKey: required("OBJECT_STORAGE_SECRET_KEY"),
  };
}

export function createS3Client(config: S3ObjectStorageConfig): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    forcePathStyle: true,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export async function assertS3BucketReady(
  client: S3Client,
  bucket: string,
): Promise<void> {
  await client.send(new HeadBucketCommand({ Bucket: bucket }));
}

export function createS3ObjectStorage(
  client: S3Client,
  bucket: string,
): ObjectStorage {
  return {
    async put(object) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: object.key,
          Body: object.bytes,
          ContentType: object.contentType,
          Metadata: object.metadata,
        }),
      );
    },
    async get(key) {
      try {
        const result = await client.send(
          new GetObjectCommand({ Bucket: bucket, Key: key }),
        );
        return result.Body ? result.Body.transformToByteArray() : null;
      } catch (error) {
        if (
          error instanceof S3ServiceException &&
          (error.name === "NoSuchKey" ||
            error.name === "NotFound" ||
            error.$metadata.httpStatusCode === 404)
        ) {
          return null;
        }
        throw error;
      }
    },
    async remove(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

export function createEnvironmentS3ObjectStorage(): ObjectStorage {
  let storage: ObjectStorage | undefined;
  const current = () => {
    if (!storage) {
      const config = objectStorageConfigFromEnvironment();
      storage = createS3ObjectStorage(createS3Client(config), config.bucket);
    }
    return storage;
  };
  return {
    put: (object) => current().put(object),
    get: (key) => current().get(key),
    remove: (key) => current().remove(key),
  };
}
