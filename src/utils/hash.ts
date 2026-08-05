import { createHash, timingSafeEqual } from "node:crypto";

import bcrypt from "bcryptjs";

const SHA256_PREFIX = "sha256:";

function createSha256Hash(value: string): string {
    return `${SHA256_PREFIX}${createHash("sha256").update(value).digest("hex")}`;
}

export function hashValue(value: string): Promise<string> {
    return Promise.resolve(createSha256Hash(value));
}

export async function verifyHash(value: string, hashedValue: string): Promise<boolean> {
    // Backward compatibility for refresh-token sessions created before
    // the SHA-256 migration. After one successful rotation, the new
    // session will use the faster SHA-256 format.
    if (!hashedValue.startsWith(SHA256_PREFIX)) {
        return bcrypt.compare(value, hashedValue);
    }

    const expectedHash = Buffer.from(hashedValue, "utf8");
    const actualHash = Buffer.from(createSha256Hash(value), "utf8");

    if (expectedHash.length !== actualHash.length) {
        return false;
    }

    return timingSafeEqual(expectedHash, actualHash);
}
