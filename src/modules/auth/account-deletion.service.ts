import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { verifyPassword } from "../../utils/password.js";
import { deleteCoverLetterObject } from "../job-seeker-application/application-cover-letter-storage.service.js";
import { deleteResumeObject } from "../resume/resume-storage.service.js";

import type { DeleteAccountInput } from "./auth.validation.js";

const DELETED_EMAIL_DOMAIN = "deleted.jobsspot.invalid";

function createDeletedEmail(userId: string): string {
    return `deleted+${userId}@${DELETED_EMAIL_DOMAIN}`;
}

export async function deleteCurrentUserAccount({
    userId,
    data,
}: {
    userId: string;
    data: DeleteAccountInput;
}) {
    const user = await prisma.user.findFirst({
        where: {
            id: userId,
            deletedAt: null,
        },
        select: {
            id: true,
            email: true,
            passwordHash: true,
            isAdmin: true,
            companyMemberships: {
                where: {
                    deletedAt: null,
                    role: "OWNER",
                    company: {
                        deletedAt: null,
                    },
                },
                select: {
                    company: {
                        select: {
                            id: true,
                            name: true,
                            _count: {
                                select: {
                                    memberships: {
                                        where: {
                                            deletedAt: null,
                                            role: "OWNER",
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            resumes: {
                select: {
                    fileKey: true,
                },
            },
            applications: {
                select: {
                    id: true,
                    coverLetterFileKey: true,
                },
            },
        },
    });

    if (!user) {
        throw new AppError(404, "User account not found.");
    }

    if (user.isAdmin) {
        throw new AppError(
            409,
            "Platform administrator accounts cannot be deleted from Account Settings. Remove platform-admin access first.",
        );
    }

    if (data.confirmationEmail !== user.email.toLowerCase()) {
        throw new AppError(400, "The confirmation email does not match your JobsSpot account.");
    }

    if (user.passwordHash) {
        if (!data.currentPassword) {
            throw new AppError(400, "Your current password is required to delete this account.");
        }

        const passwordMatches = await verifyPassword(data.currentPassword, user.passwordHash);

        if (!passwordMatches) {
            throw new AppError(400, "Current password is incorrect.");
        }
    }

    const soleOwnerCompanies = user.companyMemberships
        .filter((membership) => membership.company._count.memberships <= 1)
        .map((membership) => membership.company.name);

    if (soleOwnerCompanies.length > 0) {
        throw new AppError(
            409,
            `Transfer ownership before deleting your account. You are the only owner of: ${soleOwnerCompanies.join(", ")}.`,
        );
    }

    const deletedAt = new Date();
    const anonymizedEmail = createDeletedEmail(user.id);
    const applicationIds = user.applications.map((application) => application.id);
    const resumeFileKeys = Array.from(new Set(user.resumes.map((resume) => resume.fileKey)));
    const coverLetterFileKeys = Array.from(
        new Set(
            user.applications
                .map((application) => application.coverLetterFileKey)
                .filter((fileKey): fileKey is string => Boolean(fileKey)),
        ),
    );

    const result = await prisma.$transaction(
        async (transaction) => {
            const revokedSessions = await transaction.refreshToken.deleteMany({
                where: { userId },
            });

            await transaction.application.updateMany({
                where: { applicantId: userId },
                data: {
                    resumeId: null,
                    coverLetter: null,
                    coverLetterFileKey: null,
                    coverLetterFileName: null,
                    coverLetterFileMimeType: null,
                    coverLetterFileSize: null,
                },
            });

            await transaction.companyMembership.updateMany({
                where: {
                    userId,
                    deletedAt: null,
                },
                data: { deletedAt },
            });

            await transaction.savedJob.deleteMany({ where: { userId } });
            await transaction.savedSearch.deleteMany({ where: { userId } });
            await transaction.notification.deleteMany({ where: { userId } });
            await transaction.notificationPreference.deleteMany({ where: { userId } });
            await transaction.emailVerificationToken.deleteMany({ where: { userId } });
            await transaction.passwordResetToken.deleteMany({ where: { userId } });
            await transaction.oAuthAccount.deleteMany({ where: { userId } });
            await transaction.jobSeekerProfile.deleteMany({ where: { userId } });
            await transaction.resume.deleteMany({ where: { userId } });

            await transaction.companyInvitation.updateMany({
                where: {
                    email: user.email,
                    acceptedAt: null,
                    cancelledAt: null,
                },
                data: {
                    email: anonymizedEmail,
                    cancelledAt: deletedAt,
                },
            });

            await transaction.companyInvitation.updateMany({
                where: {
                    email: user.email,
                },
                data: {
                    email: anonymizedEmail,
                },
            });

            await transaction.auditLog.updateMany({
                where: { actorUserId: userId },
                data: {
                    actorDisplayName: "Deleted user",
                    actorEmail: anonymizedEmail,
                },
            });

            await transaction.platformAuditLog.updateMany({
                where: { actorUserId: userId },
                data: {
                    actorDisplayName: "Deleted user",
                    actorEmail: anonymizedEmail,
                },
            });

            await transaction.platformAuditLog.updateMany({
                where: {
                    entityType: "USER",
                    entityId: userId,
                },
                data: {
                    metadata: { anonymized: true },
                },
            });

            if (applicationIds.length > 0) {
                await transaction.auditLog.updateMany({
                    where: {
                        entityType: "APPLICATION",
                        entityId: { in: applicationIds },
                    },
                    data: {
                        metadata: { applicantAnonymized: true },
                    },
                });
            }

            await transaction.user.update({
                where: { id: userId },
                data: {
                    email: anonymizedEmail,
                    passwordHash: null,
                    firstName: "Deleted",
                    lastName: "User",
                    phone: null,
                    avatarUrl: null,
                    isEmailVerified: false,
                    isAdmin: false,
                    suspendedAt: null,
                    suspensionReason: null,
                    suspendedById: null,
                    deletedAt,
                },
            });

            return {
                revokedSessions: revokedSessions.count,
            };
        },
        { timeout: 20_000 },
    );

    let resumeFilesRemoved = 0;
    let resumeFileCleanupFailures = 0;

    for (const fileKey of resumeFileKeys) {
        try {
            await deleteResumeObject(fileKey);
            resumeFilesRemoved += 1;
        } catch (error) {
            resumeFileCleanupFailures += 1;
            console.error("Unable to remove a resume object after account deletion.", {
                userId,
                fileKey,
                error,
            });
        }
    }

    for (const fileKey of coverLetterFileKeys) {
        await deleteCoverLetterObject(fileKey);
    }

    return {
        deletedAt,
        revokedSessions: result.revokedSessions,
        files: {
            resumeFilesRemoved,
            resumeFileCleanupFailures,
            coverLetterFilesProcessed: coverLetterFileKeys.length,
        },
    };
}
