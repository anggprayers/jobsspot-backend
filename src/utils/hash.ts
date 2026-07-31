import bcrypt from "bcryptjs";

const HASH_ROUNDS = 12;

export function hashValue(value: string): Promise<string> {
    return bcrypt.hash(value, HASH_ROUNDS);
}

export function verifyHash(value: string, hashedValue: string): Promise<boolean> {
    return bcrypt.compare(value, hashedValue);
}
