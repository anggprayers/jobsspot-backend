import { prisma } from "../../lib/prisma.js";
import { hashValue, verifyHash } from "../../utils/hash.js";

type CreateRefreshTokenSessionParams = {
    tokenId: string;
    userId: string;
    refreshToken: string;
    expiresAt: Date;
    deviceInfo?: string;
    ipAddress?: string;
    userAgent?: string;
};

type RotateRefreshTokenSessionParams = {
    currentTokenId: string;
    newTokenId: string;
    userId: string;
    newRefreshToken: string;
    expiresAt: Date;
    deviceInfo?: string;
    ipAddress?: string;
    userAgent?: string;
};

export async function createRefreshTokenSession({
    tokenId,
    userId,
    refreshToken,
    expiresAt,
    deviceInfo,
    ipAddress,
    userAgent,
}: CreateRefreshTokenSessionParams) {
    const tokenHash = await hashValue(refreshToken);

    return prisma.refreshToken.create({
        data: {
            tokenId,
            userId,
            tokenHash,
            expiresAt,
            deviceInfo: deviceInfo ?? null,
            ipAddress: ipAddress ?? null,
            userAgent: userAgent ?? null,
        },
    });
}

export async function findRefreshTokenSession(tokenId: string) {
    return prisma.refreshToken.findUnique({
        where: {
            tokenId,
        },
    });
}

export async function verifyRefreshTokenSession(refreshToken: string, tokenHash: string): Promise<boolean> {
    return verifyHash(refreshToken, tokenHash);
}

export async function revokeRefreshTokenSession(tokenId: string) {
    return prisma.refreshToken.updateMany({
        where: {
            tokenId,
            revokedAt: null,
        },
        data: {
            revokedAt: new Date(),
        },
    });
}

export async function revokeAllUserRefreshTokenSessions(userId: string) {
    return prisma.refreshToken.updateMany({
        where: {
            userId,
            revokedAt: null,
        },
        data: {
            revokedAt: new Date(),
        },
    });
}

export async function rotateRefreshTokenSession({
    currentTokenId,
    newTokenId,
    userId,
    newRefreshToken,
    expiresAt,
    deviceInfo,
    ipAddress,
    userAgent,
}: RotateRefreshTokenSessionParams) {
    const newTokenHash = await hashValue(newRefreshToken);
    const revokedAt = new Date();

    return prisma.$transaction(async (transaction) => {
        const revokeResult = await transaction.refreshToken.updateMany({
            where: {
                tokenId: currentTokenId,
                userId,
                revokedAt: null,
                expiresAt: {
                    gt: revokedAt,
                },
            },
            data: {
                revokedAt,
            },
        });

        if (revokeResult.count !== 1) {
            return null;
        }

        return transaction.refreshToken.create({
            data: {
                tokenId: newTokenId,
                userId,
                tokenHash: newTokenHash,
                expiresAt,
                deviceInfo: deviceInfo ?? null,
                ipAddress: ipAddress ?? null,
                userAgent: userAgent ?? null,
            },
        });
    });
}
