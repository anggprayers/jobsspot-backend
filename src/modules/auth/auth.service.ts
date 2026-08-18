import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { hashPassword, verifyPassword } from "../../utils/password.js";
import {
    createTokenId,
    generateAccessToken,
    generateRefreshToken,
    getRefreshTokenExpirationDate,
    verifyRefreshToken,
} from "../../utils/token.js";

import type { ChangePasswordInput, LoginInput, RegisterInput, UpdateProfileInput } from "./auth.validation.js";

import {
    createRefreshTokenSession,
    findRefreshTokenSession,
    revokeRefreshTokenSession,
    rotateRefreshTokenSession,
    verifyRefreshTokenSession,
} from "./auth.token.service.js";

async function findCurrentUserProfile(userId: string) {
    const user = await prisma.user.findFirst({
        where: {
            id: userId,
            deletedAt: null,
            suspendedAt: null,
        },

        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            avatarUrl: true,
            isEmailVerified: true,
            isAdmin: true,
            passwordHash: true,
            createdAt: true,

            companyMemberships: {
                where: {
                    deletedAt: null,

                    company: {
                        deletedAt: null,
                        suspendedAt: null,
                    },
                },

                select: {
                    id: true,
                    role: true,
                    joinedAt: true,

                    company: {
                        select: {
                            id: true,
                            name: true,
                            slug: true,
                            logoUrl: true,
                            isVerified: true,
                        },
                    },
                },

                orderBy: {
                    joinedAt: "asc",
                },
            },
        },
    });

    if (!user) {
        return null;
    }

    const {
        companyMemberships,
        passwordHash,
        ...userDetails
    } = user;

    return {
        ...userDetails,
        hasPassword: passwordHash !== null,

        memberships: companyMemberships.map((membership) => ({
            membershipId: membership.id,
            companyId: membership.company.id,
            companyName: membership.company.name,
            companySlug: membership.company.slug,
            companyLogoUrl: membership.company.logoUrl,
            companyIsVerified: membership.company.isVerified,
            role: membership.role,
            joinedAt: membership.joinedAt,
        })),
    };
}

export async function registerUser(data: RegisterInput) {
    const existingUser = await prisma.user.findUnique({
        where: {
            email: data.email,
        },
    });

    if (existingUser) {
        throw new AppError(409, "An account with this email already exists.");
    }

    const passwordHash = await hashPassword(data.password);

    const user = await prisma.user.create({
        data: {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            passwordHash,
        },

        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            createdAt: true,
        },
    });

    return user;
}


export async function createAuthenticatedUserSession(
    userId: string,
) {
    const user =
        await findCurrentUserProfile(userId);

    if (!user) {
        throw new AppError(
            404,
            "User account not found.",
        );
    }

    const tokenId = createTokenId();

    const accessToken =
        generateAccessToken({
            userId: user.id,
            email: user.email,
        });

    const refreshToken =
        generateRefreshToken({
            userId: user.id,
            tokenId,
        });

    await createRefreshTokenSession({
        tokenId,
        userId: user.id,
        refreshToken,
        expiresAt:
            getRefreshTokenExpirationDate(),
    });

    return {
        user,
        accessToken,
        refreshToken,
    };
}

export async function loginUser(data: LoginInput) {
    const user = await prisma.user.findUnique({
        where: {
            email: data.email,
        },

        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            passwordHash: true,
            suspendedAt: true,
            createdAt: true,
        },
    });

    if (!user || !user.passwordHash) {
        throw new AppError(401, "Invalid email or password.");
    }

    if (user.suspendedAt) {
        throw new AppError(403, "This account has been suspended. Contact JobsSpot support for assistance.");
    }

    const passwordMatches = await verifyPassword(data.password, user.passwordHash);

    if (!passwordMatches) {
        throw new AppError(401, "Invalid email or password.");
    }

    const tokenId = createTokenId();

    const accessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
    });

    const refreshToken = generateRefreshToken({
        userId: user.id,
        tokenId,
    });

    await createRefreshTokenSession({
        tokenId,
        userId: user.id,
        refreshToken,
        expiresAt: getRefreshTokenExpirationDate(),
    });

    const { passwordHash: _passwordHash, suspendedAt: _suspendedAt, ...safeUser } = user;

    return {
        user: safeUser,
        accessToken,
        refreshToken,
    };
}

export async function refreshUserSession(refreshToken: string) {
    let payload;

    try {
        payload = verifyRefreshToken(refreshToken);
    } catch {
        throw new AppError(401, "Invalid or expired refresh token.");
    }

    const session = await findRefreshTokenSession(payload.tokenId);

    if (!session) {
        throw new AppError(401, "Refresh token session not found.");
    }

    if (session.userId !== payload.userId) {
        throw new AppError(401, "Invalid refresh token session.");
    }

    if (session.revokedAt) {
        throw new AppError(401, "Refresh token has already been revoked.");
    }

    if (session.expiresAt <= new Date()) {
        throw new AppError(401, "Refresh token has expired.");
    }

    const tokenMatches = await verifyRefreshTokenSession(refreshToken, session.tokenHash);

    if (!tokenMatches) {
        throw new AppError(401, "Invalid refresh token.");
    }

    const user = await findCurrentUserProfile(payload.userId);

    if (!user) {
        throw new AppError(401, "User no longer exists.");
    }

    const newTokenId = createTokenId();

    const newAccessToken = generateAccessToken({
        userId: user.id,
        email: user.email,
    });

    const newRefreshToken = generateRefreshToken({
        userId: user.id,
        tokenId: newTokenId,
    });

    const newSession = await rotateRefreshTokenSession({
        currentTokenId: payload.tokenId,
        newTokenId,
        userId: user.id,
        newRefreshToken,
        expiresAt: getRefreshTokenExpirationDate(),
    });

    if (!newSession) {
        throw new AppError(401, "Refresh token is no longer valid.");
    }

    return {
        user,
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
    };
}

export async function logoutUser(refreshToken: string): Promise<void> {
    let payload;

    try {
        payload = verifyRefreshToken(refreshToken);
    } catch {
        return;
    }

    const session = await findRefreshTokenSession(payload.tokenId);

    if (!session) {
        return;
    }

    if (session.userId !== payload.userId) {
        return;
    }

    if (session.revokedAt) {
        return;
    }

    const tokenMatches = await verifyRefreshTokenSession(refreshToken, session.tokenHash);

    if (!tokenMatches) {
        return;
    }

    await revokeRefreshTokenSession(payload.tokenId);
}

export async function getCurrentUserProfile(userId: string) {
    const user = await findCurrentUserProfile(userId);

    if (!user) {
        throw new AppError(404, "User not found.");
    }

    return user;
}

export async function updateCurrentUserProfile(userId: string, data: UpdateProfileInput) {
    const updateResult = await prisma.user.updateMany({
        where: {
            id: userId,
            deletedAt: null,
        },

        data: {
            firstName: data.firstName,
            lastName: data.lastName,
            phone: data.phone,
        },
    });

    if (updateResult.count !== 1) {
        throw new AppError(404, "User not found.");
    }

    return getCurrentUserProfile(userId);
}

export async function changeCurrentUserPassword(userId: string, data: ChangePasswordInput) {
    const user = await prisma.user.findFirst({
        where: {
            id: userId,
            deletedAt: null,
        },

        select: {
            id: true,
            passwordHash: true,
        },
    });

    if (!user) {
        throw new AppError(404, "User not found.");
    }

    if (!user.passwordHash) {
        throw new AppError(400, "Password changes are unavailable for this account.");
    }

    const currentPasswordMatches = await verifyPassword(data.currentPassword, user.passwordHash);

    if (!currentPasswordMatches) {
        throw new AppError(400, "Current password is incorrect.");
    }

    const newPasswordHash = await hashPassword(data.newPassword);

    const revokedAt = new Date();

    const [, revokedSessions] = await prisma.$transaction([
        prisma.user.update({
            where: {
                id: userId,
            },

            data: {
                passwordHash: newPasswordHash,
            },
        }),

        prisma.refreshToken.updateMany({
            where: {
                userId,
                revokedAt: null,
            },

            data: {
                revokedAt,
            },
        }),
    ]);

    return {
        revokedSessions: revokedSessions.count,
    };
}
