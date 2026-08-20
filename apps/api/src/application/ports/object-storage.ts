export interface StoredObject {
  readonly key: string;
  readonly bytes: Uint8Array;
  readonly contentType: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface ObjectStorage {
  put(object: StoredObject): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
  remove(key: string): Promise<void>;
}

export function tenantObjectKey(input: {
  tenantId: string;
  category: "imports" | "exports" | "evidence";
  objectId: string;
  extension: string;
}): string {
  const safePart = /^[a-zA-Z0-9-]+$/;
  if (
    !safePart.test(input.tenantId) ||
    !safePart.test(input.objectId) ||
    !/^[a-zA-Z0-9]+$/.test(input.extension)
  ) {
    throw new Error("Unsafe object storage key part.");
  }
  return `${input.tenantId}/${input.category}/${input.objectId}.${input.extension.toLowerCase()}`;
}
