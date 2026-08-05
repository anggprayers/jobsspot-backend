import { OAuth2Client } from "google-auth-library";

import { OAuthProvider } from "../../generated/prisma/client.js";

import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";

import { googleAuthConfig } from "./google-auth.config.js";

const googleClient = new OAuth2Client(
    googleAuthConfig.clientId,
);

type VerifiedGoogleProfile = {
    providerAccountId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
};

type GoogleAuthenticationResult = {
    userId: string;
    isNewUser: boolean;
    accountLinked: boolean;
};

function normalizeNamePart(
    value: string | undefined,
    fallback: string,
): string {
    const normalized =
        value?.trim().replace(/\s+/g, " ");

    return (
        normalized && normalized.length > 0
            ? normalized
            : fallback
    ).slice(0, 50);
}

function resolveGoogleNames({
    givenName,
    familyName,
    fullName,
    email,
}: {
    givenName: string | undefined;
    familyName: string | undefined;
    fullName: string | undefined;
    email: string;
}) {
    const normalizedFullName =
        fullName
            ?.trim()
            .replace(/\s+/g, " ");

    const fullNameParts =
        normalizedFullName
            ?.split(" ")
            .filter(Boolean) ?? [];

    const emailName =
        email
            .split("@")[0]
            ?.replace(/[._-]+/g, " ")
            .trim();

    const firstName = normalizeNamePart(
        givenName ??
            fullNameParts[0] ??
            emailName,
        "Google",
    );

    const lastName = normalizeNamePart(
        familyName ??
            (fullNameParts.length > 1
                ? fullNameParts
                      .slice(1)
                      .join(" ")
                : undefined),
        "User",
    );

    return {
        firstName,
        lastName,
    };
}

async function verifyGoogleCredential(
    credential: string,
): Promise<VerifiedGoogleProfile> {
    try {
        const ticket =
            await googleClient.verifyIdToken({
                idToken: credential,
                audience:
                    googleAuthConfig.clientId,
            });

        const payload =
            ticket.getPayload();

        if (
            !payload?.sub ||
            !payload.email ||
            payload.email_verified !== true
        ) {
            throw new AppError(
                401,
                "Google could not confirm a verified email address for this account.",
            );
        }

        const email =
            payload.email
                .trim()
                .toLowerCase();

        const {
            firstName,
            lastName,
        } = resolveGoogleNames({
            givenName:
                payload.given_name,
            familyName:
                payload.family_name,
            fullName: payload.name,
            email,
        });

        return {
            providerAccountId:
                payload.sub,
            email,
            firstName,
            lastName,
            avatarUrl:
                payload.picture?.trim() ||
                null,
        };
    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }

        console.warn(
            "Google ID token verification failed.",
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Unknown Google token verification error.",
            },
        );

        throw new AppError(
            401,
            "Google sign-in could not be verified. Please try again.",
        );
    }
}

function isUniqueConstraintError(
    error: unknown,
): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
    );
}

async function updateGoogleLinkedUser({
    userId,
    currentAvatarUrl,
    googleAvatarUrl,
}: {
    userId: string;
    currentAvatarUrl: string | null;
    googleAvatarUrl: string | null;
}) {
    await prisma.user.update({
        where: {
            id: userId,
        },

        data: {
            isEmailVerified: true,

            ...(
                !currentAvatarUrl &&
                googleAvatarUrl
                    ? {
                          avatarUrl:
                              googleAvatarUrl,
                      }
                    : {}
            ),
        },
    });
}

async function resolveConcurrentGoogleLink(
    profile: VerifiedGoogleProfile,
): Promise<GoogleAuthenticationResult | null> {
    const linkedAccount =
        await prisma.oAuthAccount.findUnique({
            where: {
                provider_providerAccountId:
                    {
                        provider:
                            OAuthProvider.GOOGLE,
                        providerAccountId:
                            profile.providerAccountId,
                    },
            },

            select: {
                user: {
                    select: {
                        id: true,
                        deletedAt: true,
                        avatarUrl: true,
                    },
                },
            },
        });

    if (
        !linkedAccount ||
        linkedAccount.user.deletedAt
    ) {
        return null;
    }

    await updateGoogleLinkedUser({
        userId:
            linkedAccount.user.id,
        currentAvatarUrl:
            linkedAccount.user
                .avatarUrl,
        googleAvatarUrl:
            profile.avatarUrl,
    });

    return {
        userId:
            linkedAccount.user.id,
        isNewUser: false,
        accountLinked: false,
    };
}

export async function authenticateWithGoogle(
    credential: string,
): Promise<GoogleAuthenticationResult> {
    const profile =
        await verifyGoogleCredential(
            credential,
        );

    const linkedAccount =
        await prisma.oAuthAccount.findUnique({
            where: {
                provider_providerAccountId:
                    {
                        provider:
                            OAuthProvider.GOOGLE,
                        providerAccountId:
                            profile.providerAccountId,
                    },
            },

            select: {
                user: {
                    select: {
                        id: true,
                        deletedAt: true,
                        avatarUrl: true,
                    },
                },
            },
        });

    if (linkedAccount) {
        if (
            linkedAccount.user.deletedAt
        ) {
            throw new AppError(
                403,
                "This JobsSpot account is unavailable.",
            );
        }

        await updateGoogleLinkedUser({
            userId:
                linkedAccount.user.id,
            currentAvatarUrl:
                linkedAccount.user
                    .avatarUrl,
            googleAvatarUrl:
                profile.avatarUrl,
        });

        return {
            userId:
                linkedAccount.user.id,
            isNewUser: false,
            accountLinked: false,
        };
    }

    const existingUser =
        await prisma.user.findUnique({
            where: {
                email: profile.email,
            },

            select: {
                id: true,
                deletedAt: true,
                avatarUrl: true,

                oauthAccounts: {
                    where: {
                        provider:
                            OAuthProvider.GOOGLE,
                    },

                    select: {
                        providerAccountId:
                            true,
                    },

                    take: 1,
                },
            },
        });

    if (existingUser) {
        if (existingUser.deletedAt) {
            throw new AppError(
                403,
                "This JobsSpot account is unavailable.",
            );
        }

        const existingGoogleAccount =
            existingUser
                .oauthAccounts[0];

        if (
            existingGoogleAccount &&
            existingGoogleAccount
                .providerAccountId !==
                profile.providerAccountId
        ) {
            throw new AppError(
                409,
                "This JobsSpot account is already linked to another Google account.",
            );
        }

        if (existingGoogleAccount) {
            await updateGoogleLinkedUser({
                userId:
                    existingUser.id,
                currentAvatarUrl:
                    existingUser.avatarUrl,
                googleAvatarUrl:
                    profile.avatarUrl,
            });

            return {
                userId:
                    existingUser.id,
                isNewUser: false,
                accountLinked: false,
            };
        }

        try {
            await prisma.$transaction([
                prisma.user.update({
                    where: {
                        id: existingUser.id,
                    },

                    data: {
                        isEmailVerified:
                            true,

                        ...(
                            !existingUser.avatarUrl &&
                            profile.avatarUrl
                                ? {
                                      avatarUrl:
                                          profile.avatarUrl,
                                  }
                                : {}
                        ),
                    },
                }),

                prisma.oAuthAccount.create({
                    data: {
                        userId:
                            existingUser.id,
                        provider:
                            OAuthProvider.GOOGLE,
                        providerAccountId:
                            profile.providerAccountId,
                    },
                }),
            ]);
        } catch (error) {
            if (
                isUniqueConstraintError(
                    error,
                )
            ) {
                const concurrentResult =
                    await resolveConcurrentGoogleLink(
                        profile,
                    );

                if (concurrentResult) {
                    return concurrentResult;
                }
            }

            throw error;
        }

        return {
            userId:
                existingUser.id,
            isNewUser: false,
            accountLinked: true,
        };
    }

    try {
        const user =
            await prisma.user.create({
                data: {
                    email:
                        profile.email,
                    passwordHash: null,
                    firstName:
                        profile.firstName,
                    lastName:
                        profile.lastName,
                    avatarUrl:
                        profile.avatarUrl,
                    isEmailVerified: true,

                    oauthAccounts: {
                        create: {
                            provider:
                                OAuthProvider.GOOGLE,
                            providerAccountId:
                                profile.providerAccountId,
                        },
                    },
                },

                select: {
                    id: true,
                },
            });

        return {
            userId: user.id,
            isNewUser: true,
            accountLinked: false,
        };
    } catch (error) {
        if (
            isUniqueConstraintError(error)
        ) {
            const concurrentResult =
                await resolveConcurrentGoogleLink(
                    profile,
                );

            if (concurrentResult) {
                return concurrentResult;
            }

            throw new AppError(
                409,
                "A JobsSpot account already exists for this Google email. Please try signing in again.",
            );
        }

        throw error;
    }
}
