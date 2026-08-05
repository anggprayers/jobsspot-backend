import {
    createHash,
    randomBytes,
} from "node:crypto";

import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";
import {
    hashPassword,
    verifyPassword,
} from "../../utils/password.js";

import { emailConfig } from "../email/email.config.js";
import { sendTransactionalEmail } from "../email/email.service.js";
import { createPasswordResetTemplate } from "../email/templates/password-reset.template.js";

import type {
    ResetPasswordInput,
} from "./auth.validation.js";

const PASSWORD_RESET_TOKEN_BYTES = 32;

function createRawPasswordResetToken(): string {
    return randomBytes(
        PASSWORD_RESET_TOKEN_BYTES,
    ).toString("base64url");
}

function hashPasswordResetToken(
    token: string,
): string {
    return createHash("sha256")
        .update(token)
        .digest("hex");
}

function getPasswordResetExpirationDate(): Date {
    return new Date(
        Date.now() +
            emailConfig
                .passwordResetTokenTtlMinutes *
                60 *
                1000,
    );
}

function createPasswordResetUrl(
    token: string,
): string {
    const resetUrl = new URL(
        "/reset-password",
        `${emailConfig.frontendUrl}/`,
    );

    resetUrl.searchParams.set(
        "token",
        token,
    );

    return resetUrl.toString();
}

export async function requestPasswordReset(
    email: string,
) {
    const user = await prisma.user.findFirst({
        where: {
            email,
            deletedAt: null,
        },

        select: {
            id: true,
            email: true,
            firstName: true,
            passwordHash: true,
        },
    });

    // Always return the same public result. This prevents
    // account discovery through the forgot-password endpoint.
    if (
        !user ||
        !user.passwordHash
    ) {
        return {
            emailSent: false,
        };
    }

    const rawToken =
        createRawPasswordResetToken();
    const tokenHash =
        hashPasswordResetToken(rawToken);
    const expiresAt =
        getPasswordResetExpirationDate();

    const [, tokenRecord] =
        await prisma.$transaction([
            prisma.passwordResetToken.deleteMany(
                {
                    where: {
                        userId: user.id,
                    },
                },
            ),

            prisma.passwordResetToken.create({
                data: {
                    userId: user.id,
                    tokenHash,
                    expiresAt,
                },

                select: {
                    id: true,
                },
            }),
        ]);

    const resetUrl =
        createPasswordResetUrl(rawToken);

    const emailContent =
        createPasswordResetTemplate({
            recipientName:
                user.firstName.trim() ||
                "there",
            actionUrl: resetUrl,
        });

    try {
        await sendTransactionalEmail({
            to: user.email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
            idempotencyKey: `password-reset/${tokenRecord.id}`,
        });

        return {
            emailSent: true,
        };
    } catch (error) {
        console.error(
            "JobsSpot could not deliver a password-reset email.",
            {
                userId: user.id,
                error:
                    error instanceof Error
                        ? error.message
                        : "Unknown email delivery error.",
            },
        );

        try {
            await prisma.passwordResetToken.deleteMany(
                {
                    where: {
                        id: tokenRecord.id,
                    },
                },
            );
        } catch (cleanupError) {
            console.error(
                "Unable to remove an undelivered password-reset token.",
                cleanupError,
            );
        }

        // The controller still returns the generic public
        // response so this endpoint never reveals account state.
        return {
            emailSent: false,
        };
    }
}

export async function resetUserPassword(
    data: ResetPasswordInput,
) {
    const normalizedToken =
        data.token.trim();

    const tokenHash =
        hashPasswordResetToken(
            normalizedToken,
        );

    const tokenRecord =
        await prisma.passwordResetToken.findUnique(
            {
                where: {
                    tokenHash,
                },

                select: {
                    id: true,
                    userId: true,
                    expiresAt: true,
                    usedAt: true,

                    user: {
                        select: {
                            id: true,
                            deletedAt: true,
                            passwordHash: true,
                        },
                    },
                },
            },
        );

    if (
        !tokenRecord ||
        tokenRecord.user.deletedAt
    ) {
        throw new AppError(
            400,
            "This password reset link is invalid or has already been replaced.",
        );
    }

    if (tokenRecord.usedAt) {
        throw new AppError(
            400,
            "This password reset link has already been used.",
        );
    }

    const now = new Date();

    if (tokenRecord.expiresAt <= now) {
        throw new AppError(
            410,
            "This password reset link has expired. Request a new one.",
        );
    }

    if (
        tokenRecord.user.passwordHash
    ) {
        const passwordIsUnchanged =
            await verifyPassword(
                data.newPassword,
                tokenRecord.user.passwordHash,
            );

        if (passwordIsUnchanged) {
            throw new AppError(
                400,
                "New password must be different from the current password.",
            );
        }
    }

    const newPasswordHash =
        await hashPassword(
            data.newPassword,
        );

    const result =
        await prisma.$transaction(
            async (transaction) => {
                const tokenUse =
                    await transaction.passwordResetToken.updateMany(
                        {
                            where: {
                                id: tokenRecord.id,
                                usedAt: null,

                                expiresAt: {
                                    gt: now,
                                },
                            },

                            data: {
                                usedAt: now,
                            },
                        },
                    );

                if (
                    tokenUse.count !== 1
                ) {
                    throw new AppError(
                        400,
                        "This password reset link is no longer valid.",
                    );
                }

                const userUpdate =
                    await transaction.user.updateMany(
                        {
                            where: {
                                id: tokenRecord.userId,
                                deletedAt: null,
                            },

                            data: {
                                passwordHash:
                                    newPasswordHash,
                            },
                        },
                    );

                if (
                    userUpdate.count !== 1
                ) {
                    throw new AppError(
                        404,
                        "User account not found.",
                    );
                }

                await transaction.passwordResetToken.updateMany(
                    {
                        where: {
                            userId:
                                tokenRecord.userId,
                            usedAt: null,
                        },

                        data: {
                            usedAt: now,
                        },
                    },
                );

                const revokedSessions =
                    await transaction.refreshToken.updateMany(
                        {
                            where: {
                                userId:
                                    tokenRecord.userId,
                                revokedAt: null,
                            },

                            data: {
                                revokedAt: now,
                            },
                        },
                    );

                return {
                    revokedSessions:
                        revokedSessions.count,
                };
            },
        );

    return result;
}
