import jwt, { type Secret, type SignOptions } from "jsonwebtoken";
import { v4 as uuid } from "uuid";

import { env } from "../config/env.js";

type TokenExpiration = NonNullable<SignOptions["expiresIn"]>;

export type AccessTokenPayload = {
    userId: string;
    email: string;
};

export type RefreshTokenPayload = {
    userId: string;
    tokenId: string;
};

export function generateAccessToken(payload: AccessTokenPayload): string {
    const options: SignOptions = {
        expiresIn: env.JWT_ACCESS_EXPIRES_IN as TokenExpiration,
        issuer: "jobsspot-api",
        audience: "jobsspot-client",
    };

    return jwt.sign(payload, env.JWT_ACCESS_SECRET as Secret, options);
}

export function generateRefreshToken(payload: RefreshTokenPayload): string {
    const options: SignOptions = {
        expiresIn: env.JWT_REFRESH_EXPIRES_IN as TokenExpiration,
        issuer: "jobsspot-api",
        audience: "jobsspot-client",
    };

    return jwt.sign(payload, env.JWT_REFRESH_SECRET as Secret, options);
}

export function verifyAccessToken(token: string): AccessTokenPayload {
    return jwt.verify(token, env.JWT_ACCESS_SECRET as Secret, {
        issuer: "jobsspot-api",
        audience: "jobsspot-client",
    }) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
    return jwt.verify(token, env.JWT_REFRESH_SECRET as Secret, {
        issuer: "jobsspot-api",
        audience: "jobsspot-client",
    }) as RefreshTokenPayload;
}

export function createTokenId(): string {
    return uuid();
}

export function getRefreshTokenExpirationDate(): Date {
    const expiresAt = new Date();

    expiresAt.setDate(expiresAt.getDate() + 7);

    return expiresAt;
}
