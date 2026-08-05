import {
    createHash,
    randomBytes,
} from "node:crypto";

import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";

import { emailConfig } from "../email/email.config.js";
import { sendTransactionalEmail } from "../email/email.service.js";
import { createVerifyEmailTemplate } from "../email/templates/verify-email.template.js";

const EMAIL_VERIFICATION_TOKEN_BYTES = 32;

function createRawVerificationToken(): string {
    return randomBytes(
        EMAIL_VERIFICATION_TOKEN_BYTES,
    ).toString("base64url");
}

function hashVerificationToken(
    token: string,
): string {
    return createHash("sha256")
        .update(token)
        .digest("hex");
}

function getVerificationExpirationDate(): Date {
    return new Date(
        Date.now() +
            emailConfig
                .verificationTokenTtlMinutes *
                60 *
                1000,
    );
}

function createVerificationUrl(
    token: string,
): string {
    const verificationUrl = new URL(
        "/verify-email",
        `${emailConfig.frontendUrl}/`,
    );

    verificationUrl.searchParams.set(
        "token",
        token,
    );

    return verificationUrl.toString();
}

export async function sendEmailVerificationForUser(
    userId: string,
) {
    const user = await prisma.user.findFirst({
        where: {
            id: userId,
            deletedAt: null,
        },

        select: {
            id: true,
            email: true,
            firstName: true,
            isEmailVerified: true,
        },
    });

    if (!user) {
        throw new AppError(
            404,
            "User account not found.",
        );
    }

    if (user.isEmailVerified) {
        return {
            emailSent: false,
            alreadyVerified: true,
            expiresAt: null,
        };
    }

    const rawToken =
        createRawVerificationToken();
    const tokenHash =
        hashVerificationToken(rawToken);
    const expiresAt =
        getVerificationExpirationDate();

    const [, tokenRecord] =
        await prisma.$transaction([
            prisma.emailVerificationToken.deleteMany(
                {
                    where: {
                        userId: user.id,
                    },
                },
            ),

            prisma.emailVerificationToken.create({
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

    const verificationUrl =
        createVerificationUrl(rawToken);

    const email =
        createVerifyEmailTemplate({
            recipientName:
                user.firstName.trim() ||
                "there",
            actionUrl: verificationUrl,
        });

    try {
        const delivery =
            await sendTransactionalEmail({
                to: user.email,
                subject: email.subject,
                html: email.html,
                text: email.text,
                idempotencyKey: `email-verification/${tokenRecord.id}`,
            });

        return {
            emailSent: true,
            alreadyVerified: false,
            expiresAt,
            emailId: delivery.emailId,
        };
    } catch (error) {
        try {
            await prisma.emailVerificationToken.deleteMany(
                {
                    where: {
                        id: tokenRecord.id,
                    },
                },
            );
        } catch (cleanupError) {
            console.error(
                "Unable to remove an undelivered email-verification token.",
                cleanupError,
            );
        }

        throw error;
    }
}

export async function verifyEmailAddress(
    rawToken: string,
) {
    const normalizedToken = rawToken.trim();

    if (!normalizedToken) {
        throw new AppError(
            400,
            "A verification token is required.",
        );
    }

    const tokenHash =
        hashVerificationToken(
            normalizedToken,
        );

    const tokenRecord =
        await prisma.emailVerificationToken.findUnique(
            {
                where: {
                    tokenHash,
                },

                select: {
                    id: true,
                    userId: true,
                    expiresAt: true,
                    verifiedAt: true,

                    user: {
                        select: {
                            id: true,
                            deletedAt: true,
                            isEmailVerified: true,
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
            "This verification link is invalid or has already been replaced.",
        );
    }

    if (
        tokenRecord.user.isEmailVerified
    ) {
        if (!tokenRecord.verifiedAt) {
            await prisma.emailVerificationToken.updateMany(
                {
                    where: {
                        userId:
                            tokenRecord.userId,
                        verifiedAt: null,
                    },

                    data: {
                        verifiedAt: new Date(),
                    },
                },
            );
        }

        return {
            userId: tokenRecord.userId,
            isEmailVerified: true,
            alreadyVerified: true,
        };
    }

    if (tokenRecord.verifiedAt) {
        throw new AppError(
            400,
            "This verification link has already been used.",
        );
    }

    const now = new Date();

    if (tokenRecord.expiresAt <= now) {
        throw new AppError(
            410,
            "This verification link has expired. Request a new email from your account settings.",
        );
    }

    const [
        userUpdate,
    ] = await prisma.$transaction([
        prisma.user.updateMany({
            where: {
                id: tokenRecord.userId,
                deletedAt: null,
                isEmailVerified: false,
            },

            data: {
                isEmailVerified: true,
            },
        }),

        prisma.emailVerificationToken.updateMany(
            {
                where: {
                    userId:
                        tokenRecord.userId,
                    verifiedAt: null,
                },

                data: {
                    verifiedAt: now,
                },
            },
        ),
    ]);

    if (userUpdate.count !== 1) {
        const currentUser =
            await prisma.user.findFirst({
                where: {
                    id: tokenRecord.userId,
                    deletedAt: null,
                },

                select: {
                    isEmailVerified: true,
                },
            });

        if (
            currentUser?.isEmailVerified
        ) {
            return {
                userId: tokenRecord.userId,
                isEmailVerified: true,
                alreadyVerified: true,
            };
        }

        throw new AppError(
            409,
            "The email address could not be verified. Please request a new verification email.",
        );
    }

    return {
        userId: tokenRecord.userId,
        isEmailVerified: true,
        alreadyVerified: false,
    };
}
