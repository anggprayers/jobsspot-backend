import { createHash, randomBytes } from "node:crypto";

import {
    CompanyMemberRole,
    type Prisma,
} from "../../generated/prisma/client.js";

import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";

import {
    AuditAction,
    AuditEntityType,
} from "../audit-log/audit-log.constants.js";
import { createCompanyAuditLog } from "../audit-log/audit-log.service.js";
import { emailConfig } from "../email/email.config.js";
import { sendTransactionalEmail } from "../email/email.service.js";
import { createCompanyInvitationTemplate } from "../email/templates/company-invitation.template.js";

import { lockCompanyInvitationResource } from "./company-invitation-lock.js";

import type { CreateCompanyInvitationInput } from "./company-invitation.validation.js";

const COMPANY_INVITATION_TOKEN_BYTES = 32;
const ONE_MINUTE_IN_MILLISECONDS = 60 * 1000;
const ONE_DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

const invitationEmailAuditActions = [
    AuditAction.COMPANY_INVITATION_SENT,
    AuditAction.COMPANY_INVITATION_RESENT,
];

type InvitationRateLimitType =
    | "RESEND_COOLDOWN"
    | "RECIPIENT_DAILY_LIMIT"
    | "COMPANY_DAILY_LIMIT";

const invitationSelect = {
    id: true,
    companyId: true,
    email: true,
    role: true,
    expiresAt: true,
    lastSentAt: true,
    sendCount: true,
    acceptedAt: true,
    cancelledAt: true,
    createdAt: true,
    updatedAt: true,

    invitedBy: {
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
        },
    },
} satisfies Prisma.CompanyInvitationSelect;

type SelectedInvitation = Prisma.CompanyInvitationGetPayload<{
    select: typeof invitationSelect;
}>;

type InvitationStatus =
    | "PENDING"
    | "EXPIRED"
    | "ACCEPTED"
    | "CANCELLED";

type InvitationManager = {
    company: {
        id: string;
        name: string;
    };
    actor: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
    };
    role: CompanyMemberRole;
};

type InvitationSnapshot = {
    role: CompanyMemberRole;
    tokenHash: string;
    invitedById: string;
    acceptedById: string | null;
    expiresAt: Date;
    lastSentAt: Date | null;
    sendCount: number;
    acceptedAt: Date | null;
    cancelledAt: Date | null;
};

function createRawInvitationToken(): string {
    return randomBytes(
        COMPANY_INVITATION_TOKEN_BYTES,
    ).toString("base64url");
}

function hashInvitationToken(
    token: string,
): string {
    return createHash("sha256")
        .update(token)
        .digest("hex");
}

function getInvitationExpirationDate(): Date {
    return new Date(
        Date.now() +
            emailConfig.companyInvitationTokenTtlDays *
                24 *
                60 *
                60 *
                1000,
    );
}

function createInvitationUrl(
    token: string,
): string {
    const invitationUrl = new URL(
        "/invitations/accept",
        `${emailConfig.frontendUrl}/`,
    );

    invitationUrl.searchParams.set(
        "token",
        token,
    );

    return invitationUrl.toString();
}

function getDisplayName(
    firstName: string,
    lastName: string,
): string {
    return `${firstName} ${lastName}`.trim();
}

function getInvitationStatus(
    invitation: Pick<
        SelectedInvitation,
        "acceptedAt" | "cancelledAt" | "expiresAt"
    >,
    now = new Date(),
): InvitationStatus {
    if (invitation.acceptedAt) {
        return "ACCEPTED";
    }

    if (invitation.cancelledAt) {
        return "CANCELLED";
    }

    if (invitation.expiresAt <= now) {
        return "EXPIRED";
    }

    return "PENDING";
}

function serializeInvitation(
    invitation: SelectedInvitation,
) {
    return {
        ...invitation,
        status: getInvitationStatus(
            invitation,
        ),
    };
}

function assertCanAssignInvitationRole(
    actorRole: CompanyMemberRole,
    invitationRole: CompanyMemberRole,
): void {
    if (
        actorRole === CompanyMemberRole.ADMIN &&
        invitationRole === CompanyMemberRole.ADMIN
    ) {
        throw new AppError(
            403,
            "Only the company owner can invite another admin.",
        );
    }
}

async function getInvitationManager(
    companyId: string,
    actorUserId: string,
): Promise<InvitationManager> {
    const company =
        await prisma.company.findFirst({
            where: {
                id: companyId,
                deletedAt: null,
            },

            select: {
                id: true,
                name: true,
            },
        });

    if (!company) {
        throw new AppError(
            404,
            "Company not found.",
        );
    }

    const membership =
        await prisma.companyMembership.findFirst({
            where: {
                companyId,
                userId: actorUserId,
                deletedAt: null,
            },

            select: {
                role: true,

                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
        });

    if (!membership) {
        throw new AppError(
            403,
            "You are not a member of this company.",
        );
    }

    if (
        membership.role !==
            CompanyMemberRole.OWNER &&
        membership.role !==
            CompanyMemberRole.ADMIN
    ) {
        throw new AppError(
            403,
            "You do not have permission to manage company invitations.",
        );
    }

    return {
        company,
        actor: membership.user,
        role: membership.role,
    };
}

type ActiveMembershipLookupClient = Pick<
    Prisma.TransactionClient,
    "user" | "companyMembership"
>;

async function assertEmailIsNotActiveMember(
    client: ActiveMembershipLookupClient,
    companyId: string,
    email: string,
): Promise<void> {
    const existingUser =
        await client.user.findFirst({
            where: {
                email,
                deletedAt: null,
            },

            select: {
                id: true,
            },
        });

    if (!existingUser) {
        return;
    }

    const existingMembership =
        await client.companyMembership.findFirst({
            where: {
                companyId,
                userId: existingUser.id,
                deletedAt: null,
            },

            select: {
                id: true,
            },
        });

    if (existingMembership) {
        throw new AppError(
            409,
            "This email address already belongs to an active company member.",
        );
    }
}

async function getRecipientName(
    email: string,
): Promise<string> {
    const user = await prisma.user.findFirst({
        where: {
            email,
            deletedAt: null,
        },

        select: {
            firstName: true,
        },
    });

    return user?.firstName.trim() || "there";
}

function createSnapshot(
    invitation: {
        role: CompanyMemberRole;
        tokenHash: string;
        invitedById: string;
        acceptedById: string | null;
        expiresAt: Date;
        lastSentAt: Date | null;
        sendCount: number;
        acceptedAt: Date | null;
        cancelledAt: Date | null;
    },
): InvitationSnapshot {
    return {
        role: invitation.role,
        tokenHash: invitation.tokenHash,
        invitedById: invitation.invitedById,
        acceptedById: invitation.acceptedById,
        expiresAt: invitation.expiresAt,
        lastSentAt: invitation.lastSentAt,
        sendCount: invitation.sendCount,
        acceptedAt: invitation.acceptedAt,
        cancelledAt: invitation.cancelledAt,
    };
}

function isPrismaUniqueConstraintError(
    error: unknown,
): boolean {
    return (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "P2002"
    );
}

function getRetryAfterSeconds(
    availableAt: Date,
    now: Date,
): number {
    return Math.max(
        1,
        Math.ceil(
            (availableAt.getTime() - now.getTime()) /
                1000,
        ),
    );
}

function createInvitationRateLimitError({
    message,
    availableAt,
    now,
    rateLimitType,
}: {
    message: string;
    availableAt: Date;
    now: Date;
    rateLimitType: InvitationRateLimitType;
}): AppError {
    const retryAfterSeconds =
        getRetryAfterSeconds(
            availableAt,
            now,
        );

    return new AppError(
        429,
        message,
        {
            details: {
                rateLimitType,
                retryAfterSeconds,
                retryAfterAt:
                    availableAt.toISOString(),
            },
            headers: {
                "Retry-After": String(
                    retryAfterSeconds,
                ),
            },
        },
    );
}

async function lockCompanyInvitationSends(
    transaction: Prisma.TransactionClient,
    companyId: string,
): Promise<void> {
    await transaction.$queryRaw<
        Array<{ lockResult: string }>
    >`
        SELECT pg_advisory_xact_lock(
            124670855,
            hashtext(${companyId}::text)
        )::text AS "lockResult"
    `;
}

async function assertInvitationEmailLimits({
    transaction,
    companyId,
    invitationId,
    lastSentAt,
    now,
}: {
    transaction: Prisma.TransactionClient;
    companyId: string;
    invitationId: string | null;
    lastSentAt: Date | null;
    now: Date;
}): Promise<void> {
    if (lastSentAt) {
        const resendAvailableAt = new Date(
            lastSentAt.getTime() +
                emailConfig
                    .companyInvitationResendCooldownMinutes *
                    ONE_MINUTE_IN_MILLISECONDS,
        );

        if (resendAvailableAt > now) {
            throw createInvitationRateLimitError({
                message:
                    "Please wait before sending another invitation to this email address.",
                availableAt: resendAvailableAt,
                now,
                rateLimitType:
                    "RESEND_COOLDOWN",
            });
        }
    }

    const dailyWindowStartedAt = new Date(
        now.getTime() -
            ONE_DAY_IN_MILLISECONDS,
    );

    const baseAuditWhere: Prisma.AuditLogWhereInput = {
        companyId,
        entityType:
            AuditEntityType.COMPANY_INVITATION,
        action: {
            in: invitationEmailAuditActions,
        },
        createdAt: {
            gte: dailyWindowStartedAt,
        },
    };

    if (invitationId) {
        const recipientSendCount =
            await transaction.auditLog.count({
                where: {
                    ...baseAuditWhere,
                    entityId: invitationId,
                },
            });

        if (
            recipientSendCount >=
            emailConfig
                .companyInvitationRecipientDailyLimit
        ) {
            const oldestRecipientSend =
                await transaction.auditLog.findFirst({
                    where: {
                        ...baseAuditWhere,
                        entityId: invitationId,
                    },
                    orderBy: {
                        createdAt: "asc",
                    },
                    select: {
                        createdAt: true,
                    },
                });

            const availableAt = new Date(
                (oldestRecipientSend?.createdAt ?? now).getTime() +
                    ONE_DAY_IN_MILLISECONDS,
            );

            throw createInvitationRateLimitError({
                message:
                    "This email address has already received the maximum number of invitations from this company in the last 24 hours.",
                availableAt,
                now,
                rateLimitType:
                    "RECIPIENT_DAILY_LIMIT",
            });
        }
    }

    const companySendCount =
        await transaction.auditLog.count({
            where: baseAuditWhere,
        });

    if (
        companySendCount >=
        emailConfig
            .companyInvitationCompanyDailyLimit
    ) {
        const oldestCompanySend =
            await transaction.auditLog.findFirst({
                where: baseAuditWhere,
                orderBy: {
                    createdAt: "asc",
                },
                select: {
                    createdAt: true,
                },
            });

        const availableAt = new Date(
            (oldestCompanySend?.createdAt ?? now).getTime() +
                ONE_DAY_IN_MILLISECONDS,
        );

        throw createInvitationRateLimitError({
            message:
                "This company has reached its invitation email limit for the last 24 hours. Please try again later.",
            availableAt,
            now,
            rateLimitType:
                "COMPANY_DAILY_LIMIT",
        });
    }
}

async function restoreInvitationAfterEmailFailure({
    invitationId,
    currentTokenHash,
    auditLogId,
    previousSnapshot,
}: {
    invitationId: string;
    currentTokenHash: string;
    auditLogId: string;
    previousSnapshot: InvitationSnapshot | null;
}): Promise<void> {
    try {
        await prisma.$transaction(
            async (transaction) => {
                await lockCompanyInvitationResource(
                    transaction,
                    invitationId,
                );

                await transaction.auditLog.deleteMany({
                    where: {
                        id: auditLogId,
                    },
                });

                if (!previousSnapshot) {
                    await transaction.companyInvitation.deleteMany({
                        where: {
                            id: invitationId,
                            tokenHash: currentTokenHash,
                            acceptedAt: null,
                            cancelledAt: null,
                        },
                    });

                    return;
                }

                await transaction.companyInvitation.updateMany({
                    where: {
                        id: invitationId,
                        tokenHash: currentTokenHash,
                        acceptedAt: null,
                        cancelledAt: null,
                    },

                    data: previousSnapshot,
                });
            },
        );
    } catch (cleanupError) {
        console.error(
            "Unable to restore a company invitation after email delivery failed.",
            {
                invitationId,
                cleanupError,
            },
        );
    }
}

async function deliverInvitationEmail({
    invitationId,
    sendCount,
    recipientEmail,
    recipientName,
    inviterName,
    companyName,
    role,
    rawToken,
    operation,
}: {
    invitationId: string;
    sendCount: number;
    recipientEmail: string;
    recipientName: string;
    inviterName: string;
    companyName: string;
    role: CompanyMemberRole;
    rawToken: string;
    operation: "send" | "resend";
}) {
    const invitationUrl =
        createInvitationUrl(rawToken);

    const email =
        createCompanyInvitationTemplate({
            recipientName,
            inviterName,
            companyName,
            role,
            actionUrl: invitationUrl,
        });

    return sendTransactionalEmail({
        to: recipientEmail,
        subject: email.subject,
        html: email.html,
        text: email.text,
        idempotencyKey: `company-invitation/${invitationId}/${operation}/${sendCount}`,
    });
}

export async function getCompanyInvitations({
    companyId,
    actorUserId,
}: {
    companyId: string;
    actorUserId: string;
}) {
    await getInvitationManager(
        companyId,
        actorUserId,
    );

    const invitations =
        await prisma.companyInvitation.findMany({
            where: {
                companyId,
                acceptedAt: null,
                cancelledAt: null,
                lastSentAt: {
                    not: null,
                },
            },

            select: invitationSelect,

            orderBy: [
                {
                    createdAt: "desc",
                },
                {
                    id: "desc",
                },
            ],
        });

    return invitations.map(
        serializeInvitation,
    );
}

export async function createCompanyInvitation({
    companyId,
    actorUserId,
    data,
}: {
    companyId: string;
    actorUserId: string;
    data: CreateCompanyInvitationInput;
}) {
    const manager =
        await getInvitationManager(
            companyId,
            actorUserId,
        );

    assertCanAssignInvitationRole(
        manager.role,
        data.role,
    );

    await assertEmailIsNotActiveMember(
        prisma,
        companyId,
        data.email,
    );

    const recipientName =
        await getRecipientName(data.email);
    const rawToken =
        createRawInvitationToken();
    const tokenHash =
        hashInvitationToken(rawToken);
    const expiresAt =
        getInvitationExpirationDate();
    const sentAt = new Date();

    const prepared = await (async () => {
        try {
            return await prisma.$transaction(
                async (transaction) => {
                    await lockCompanyInvitationSends(
                        transaction,
                        companyId,
                    );

                const existingInvitationReference =
                    await transaction.companyInvitation.findUnique({
                        where: {
                            companyId_email: {
                                companyId,
                                email: data.email,
                            },
                        },
                        select: {
                            id: true,
                        },
                    });

                if (existingInvitationReference) {
                    await lockCompanyInvitationResource(
                        transaction,
                        existingInvitationReference.id,
                    );
                }

                const existingInvitation =
                    await transaction.companyInvitation.findUnique({
                        where: {
                            companyId_email: {
                                companyId,
                                email: data.email,
                            },
                        },

                        select: {
                            id: true,
                            role: true,
                            tokenHash: true,
                            invitedById: true,
                            acceptedById: true,
                            expiresAt: true,
                            lastSentAt: true,
                            sendCount: true,
                            acceptedAt: true,
                            cancelledAt: true,
                        },
                    });

                await assertEmailIsNotActiveMember(
                    transaction,
                    companyId,
                    data.email,
                );

                if (
                    existingInvitation &&
                    !existingInvitation.acceptedAt &&
                    !existingInvitation.cancelledAt &&
                    existingInvitation.lastSentAt &&
                    existingInvitation.expiresAt > sentAt
                ) {
                    throw new AppError(
                        409,
                        "A pending invitation already exists for this email address.",
                    );
                }

                await assertInvitationEmailLimits({
                    transaction,
                    companyId,
                    invitationId:
                        existingInvitation?.id ?? null,
                    lastSentAt:
                        existingInvitation?.lastSentAt ?? null,
                    now: sentAt,
                });

                const previousSnapshot =
                    existingInvitation
                        ? createSnapshot(
                              existingInvitation,
                          )
                        : null;

                const nextSendCount =
                    (existingInvitation?.sendCount ?? 0) + 1;

                const invitation =
                    existingInvitation
                        ? await transaction.companyInvitation.update({
                              where: {
                                  id: existingInvitation.id,
                              },

                              data: {
                                  role: data.role,
                                  tokenHash,
                                  invitedById: actorUserId,
                                  acceptedById: null,
                                  expiresAt,
                                  lastSentAt: sentAt,
                                  sendCount: nextSendCount,
                                  acceptedAt: null,
                                  cancelledAt: null,
                              },

                              select: invitationSelect,
                          })
                        : await transaction.companyInvitation.create({
                              data: {
                                  companyId,
                                  email: data.email,
                                  role: data.role,
                                  tokenHash,
                                  invitedById: actorUserId,
                                  expiresAt,
                                  lastSentAt: sentAt,
                                  sendCount: nextSendCount,
                              },

                              select: invitationSelect,
                          });

                const auditLog =
                    await createCompanyAuditLog({
                        transaction,
                        companyId,
                        actorUserId,
                        action:
                            AuditAction.COMPANY_INVITATION_SENT,
                        entityType:
                            AuditEntityType.COMPANY_INVITATION,
                        entityId: invitation.id,

                        metadata: {
                            invitationId:
                                invitation.id,
                            invitedEmail:
                                invitation.email,
                            assignedRole:
                                invitation.role,
                            companyId:
                                manager.company.id,
                            companyName:
                                manager.company.name,
                            expiresAt:
                                invitation.expiresAt.toISOString(),
                            sendCount:
                                invitation.sendCount,
                        },
                    });

                    return {
                        invitation,
                        auditLogId: auditLog.id,
                        previousSnapshot,
                    };
                },
            );
        } catch (error) {
            if (
                isPrismaUniqueConstraintError(
                    error,
                )
            ) {
                throw new AppError(
                    409,
                    "A company invitation already exists for this email address.",
                );
            }

            throw error;
        }
    })();

    try {
        await deliverInvitationEmail({
            invitationId:
                prepared.invitation.id,
            sendCount:
                prepared.invitation.sendCount,
            recipientEmail:
                prepared.invitation.email,
            recipientName,
            inviterName: getDisplayName(
                manager.actor.firstName,
                manager.actor.lastName,
            ),
            companyName:
                manager.company.name,
            role: prepared.invitation.role,
            rawToken,
            operation: "send",
        });
    } catch (error) {
        await restoreInvitationAfterEmailFailure({
            invitationId:
                prepared.invitation.id,
            currentTokenHash: tokenHash,
            auditLogId: prepared.auditLogId,
            previousSnapshot:
                prepared.previousSnapshot,
        });

        throw error;
    }

    return serializeInvitation(
        prepared.invitation,
    );
}

export async function resendCompanyInvitation({
    companyId,
    invitationId,
    actorUserId,
}: {
    companyId: string;
    invitationId: string;
    actorUserId: string;
}) {
    const manager =
        await getInvitationManager(
            companyId,
            actorUserId,
        );

    const rawToken =
        createRawInvitationToken();
    const tokenHash =
        hashInvitationToken(rawToken);
    const expiresAt =
        getInvitationExpirationDate();
    const sentAt = new Date();

    const prepared =
        await prisma.$transaction(
            async (transaction) => {
                await lockCompanyInvitationSends(
                    transaction,
                    companyId,
                );

                await lockCompanyInvitationResource(
                    transaction,
                    invitationId,
                );

                const existingInvitation =
                    await transaction.companyInvitation.findFirst({
                        where: {
                            id: invitationId,
                            companyId,
                        },

                        select: {
                            id: true,
                            email: true,
                            role: true,
                            tokenHash: true,
                            invitedById: true,
                            acceptedById: true,
                            expiresAt: true,
                            lastSentAt: true,
                            sendCount: true,
                            acceptedAt: true,
                            cancelledAt: true,
                        },
                    });

                if (!existingInvitation) {
                    throw new AppError(
                        404,
                        "Company invitation not found.",
                    );
                }

                if (existingInvitation.acceptedAt) {
                    throw new AppError(
                        409,
                        "This invitation has already been accepted.",
                    );
                }

                if (existingInvitation.cancelledAt) {
                    throw new AppError(
                        409,
                        "This invitation has been cancelled. Create a new invitation instead.",
                    );
                }

                assertCanAssignInvitationRole(
                    manager.role,
                    existingInvitation.role,
                );

                await assertEmailIsNotActiveMember(
                    transaction,
                    companyId,
                    existingInvitation.email,
                );

                await assertInvitationEmailLimits({
                    transaction,
                    companyId,
                    invitationId:
                        existingInvitation.id,
                    lastSentAt:
                        existingInvitation.lastSentAt,
                    now: sentAt,
                });

                const previousSnapshot =
                    createSnapshot(
                        existingInvitation,
                    );

                const invitation =
                    await transaction.companyInvitation.update({
                        where: {
                            id: existingInvitation.id,
                        },

                        data: {
                            tokenHash,
                            expiresAt,
                            lastSentAt: sentAt,
                            sendCount: {
                                increment: 1,
                            },
                        },

                        select: invitationSelect,
                    });

                const auditLog =
                    await createCompanyAuditLog({
                        transaction,
                        companyId,
                        actorUserId,
                        action:
                            AuditAction.COMPANY_INVITATION_RESENT,
                        entityType:
                            AuditEntityType.COMPANY_INVITATION,
                        entityId: invitation.id,

                        metadata: {
                            invitationId:
                                invitation.id,
                            invitedEmail:
                                invitation.email,
                            assignedRole:
                                invitation.role,
                            companyId:
                                manager.company.id,
                            companyName:
                                manager.company.name,
                            expiresAt:
                                invitation.expiresAt.toISOString(),
                            sendCount:
                                invitation.sendCount,
                        },
                    });

                return {
                    invitation,
                    auditLogId: auditLog.id,
                    previousSnapshot,
                };
            },
        );

    const recipientName =
        await getRecipientName(
            prepared.invitation.email,
        );

    try {
        await deliverInvitationEmail({
            invitationId:
                prepared.invitation.id,
            sendCount:
                prepared.invitation.sendCount,
            recipientEmail:
                prepared.invitation.email,
            recipientName,
            inviterName: getDisplayName(
                manager.actor.firstName,
                manager.actor.lastName,
            ),
            companyName:
                manager.company.name,
            role: prepared.invitation.role,
            rawToken,
            operation: "resend",
        });
    } catch (error) {
        await restoreInvitationAfterEmailFailure({
            invitationId:
                prepared.invitation.id,
            currentTokenHash: tokenHash,
            auditLogId: prepared.auditLogId,
            previousSnapshot:
                prepared.previousSnapshot,
        });

        throw error;
    }

    return serializeInvitation(
        prepared.invitation,
    );
}

export async function cancelCompanyInvitation({
    companyId,
    invitationId,
    actorUserId,
}: {
    companyId: string;
    invitationId: string;
    actorUserId: string;
}) {
    const manager =
        await getInvitationManager(
            companyId,
            actorUserId,
        );

    return prisma.$transaction(
        async (transaction) => {
            await lockCompanyInvitationResource(
                transaction,
                invitationId,
            );

            const existingInvitation =
                await transaction.companyInvitation.findFirst({
                    where: {
                        id: invitationId,
                        companyId,
                    },

                    select: {
                        id: true,
                        role: true,
                        acceptedAt: true,
                        cancelledAt: true,
                    },
                });

            if (!existingInvitation) {
                throw new AppError(
                    404,
                    "Company invitation not found.",
                );
            }

            if (existingInvitation.acceptedAt) {
                throw new AppError(
                    409,
                    "An accepted invitation cannot be cancelled.",
                );
            }

            if (existingInvitation.cancelledAt) {
                throw new AppError(
                    409,
                    "This invitation has already been cancelled.",
                );
            }

            assertCanAssignInvitationRole(
                manager.role,
                existingInvitation.role,
            );

            const cancelledAt = new Date();

            const invitation =
                await transaction.companyInvitation.update({
                    where: {
                        id: existingInvitation.id,
                    },

                    data: {
                        cancelledAt,
                    },

                    select: invitationSelect,
                });

            await createCompanyAuditLog({
                transaction,
                companyId,
                actorUserId,
                action:
                    AuditAction.COMPANY_INVITATION_CANCELLED,
                entityType:
                    AuditEntityType.COMPANY_INVITATION,
                entityId: invitation.id,

                metadata: {
                    invitationId:
                        invitation.id,
                    invitedEmail:
                        invitation.email,
                    assignedRole:
                        invitation.role,
                    companyId:
                        manager.company.id,
                    companyName:
                        manager.company.name,
                    cancelledAt:
                        cancelledAt.toISOString(),
                },
            });

            return serializeInvitation(
                invitation,
            );
        },
    );
}
