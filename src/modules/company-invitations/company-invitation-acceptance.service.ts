import { createHash } from "node:crypto";

import {
    type Prisma,
} from "../../generated/prisma/client.js";

import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";

import {
    AuditAction,
    AuditEntityType,
} from "../audit-log/audit-log.constants.js";
import { createCompanyAuditLog } from "../audit-log/audit-log.service.js";
import { lockCompanyMembership } from "../company-members/company-membership-lock.js";

import { lockCompanyInvitationResource } from "./company-invitation-lock.js";

const COMPANY_INVITATION_ACCEPTANCE_LOCK_NAMESPACE = 124670857;

type CompanyInvitationStatus =
    | "PENDING"
    | "EXPIRED"
    | "ACCEPTED"
    | "CANCELLED";

type MembershipOutcome =
    | "CREATED"
    | "RESTORED"
    | "ALREADY_ACTIVE";

const invitationAccessSelect = {
    id: true,
    companyId: true,
    email: true,
    role: true,
    expiresAt: true,
    acceptedAt: true,
    cancelledAt: true,

    company: {
        select: {
            id: true,
            name: true,
            slug: true,
            logoUrl: true,
            deletedAt: true,
            suspendedAt: true,
        },
    },

    invitedBy: {
        select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
        },
    },
} satisfies Prisma.CompanyInvitationSelect;

type InvitationAccessRecord =
    Prisma.CompanyInvitationGetPayload<{
        select: typeof invitationAccessSelect;
    }>;

function hashInvitationToken(token: string): string {
    return createHash("sha256")
        .update(token)
        .digest("hex");
}

function normalizeEmail(email: string): string {
    return email.trim().toLocaleLowerCase();
}

function getDisplayName(
    firstName: string,
    lastName: string,
): string {
    return `${firstName} ${lastName}`.trim();
}

function maskEmail(email: string): string {
    const separatorIndex = email.lastIndexOf("@");

    if (separatorIndex <= 0) {
        return "***";
    }

    const localPart = email.slice(0, separatorIndex);
    const domain = email.slice(separatorIndex + 1);

    if (localPart.length === 1) {
        return `${localPart[0]}***@${domain}`;
    }

    const hiddenCharacters = "*".repeat(
        Math.min(
            6,
            Math.max(3, localPart.length - 2),
        ),
    );

    return `${localPart[0]}${hiddenCharacters}${localPart.at(-1)}@${domain}`;
}

function getInvitationStatus(
    invitation: Pick<
        InvitationAccessRecord,
        "acceptedAt" | "cancelledAt" | "expiresAt"
    >,
    now = new Date(),
): CompanyInvitationStatus {
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

function serializeInvitationAccess(
    invitation: InvitationAccessRecord,
) {
    const status = getInvitationStatus(
        invitation,
    );

    return {
        company: {
            id: invitation.company.id,
            name: invitation.company.name,
            slug: invitation.company.slug,
            logoUrl: invitation.company.logoUrl,
        },
        role: invitation.role,
        invitedEmailMasked: maskEmail(
            invitation.email,
        ),
        expiresAt: invitation.expiresAt,
        status,
        canAccept: status === "PENDING",
        invitedBy: {
            id: invitation.invitedBy.id,
            displayName: getDisplayName(
                invitation.invitedBy.firstName,
                invitation.invitedBy.lastName,
            ),
            avatarUrl:
                invitation.invitedBy.avatarUrl,
        },
    };
}

function assertInvitationCanBeAccepted(
    invitation: InvitationAccessRecord,
    now: Date,
): void {
    if (invitation.acceptedAt) {
        throw new AppError(
            409,
            "This company invitation has already been accepted.",
            {
                details: {
                    invitationStatus: "ACCEPTED",
                },
            },
        );
    }

    if (invitation.cancelledAt) {
        throw new AppError(
            410,
            "This company invitation has been cancelled.",
            {
                details: {
                    invitationStatus: "CANCELLED",
                },
            },
        );
    }

    if (invitation.expiresAt <= now) {
        throw new AppError(
            410,
            "This company invitation has expired. Ask the company to send a new invitation.",
            {
                details: {
                    invitationStatus: "EXPIRED",
                    expiresAt:
                        invitation.expiresAt.toISOString(),
                },
            },
        );
    }
}

async function lockCompanyInvitationAcceptance(
    transaction: Prisma.TransactionClient,
    tokenHash: string,
): Promise<void> {
    await transaction.$queryRaw<
        Array<{ lockResult: string }>
    >`
        SELECT pg_advisory_xact_lock(
            ${COMPANY_INVITATION_ACCEPTANCE_LOCK_NAMESPACE},
            hashtext(${tokenHash}::text)
        )::text AS "lockResult"
    `;
}

export async function resolveCompanyInvitation(
    rawToken: string,
) {
    const tokenHash =
        hashInvitationToken(rawToken);

    const invitation =
        await prisma.companyInvitation.findUnique({
            where: {
                tokenHash,
            },
            select: invitationAccessSelect,
        });

    if (
        !invitation ||
        invitation.company.deletedAt
    ) {
        throw new AppError(
            404,
            "Company invitation not found or this link is no longer valid.",
        );
    }

    if (invitation.company.suspendedAt) {
        throw new AppError(
            403,
            "This company workspace is currently unavailable. Contact JobsSpot support for assistance.",
        );
    }

    return serializeInvitationAccess(
        invitation,
    );
}

export async function acceptCompanyInvitation({
    rawToken,
    actorUserId,
}: {
    rawToken: string;
    actorUserId: string;
}) {
    const tokenHash =
        hashInvitationToken(rawToken);
    const acceptedAt = new Date();

    return prisma.$transaction(
        async (transaction) => {
            await lockCompanyInvitationAcceptance(
                transaction,
                tokenHash,
            );

            const invitationReference =
                await transaction.companyInvitation.findUnique({
                    where: {
                        tokenHash,
                    },
                    select: {
                        id: true,
                    },
                });

            if (!invitationReference) {
                throw new AppError(
                    404,
                    "Company invitation not found or this link is no longer valid.",
                );
            }

            await lockCompanyInvitationResource(
                transaction,
                invitationReference.id,
            );

            const invitation =
                await transaction.companyInvitation.findFirst({
                    where: {
                        id: invitationReference.id,
                        tokenHash,
                    },
                    select: invitationAccessSelect,
                });

            if (
                !invitation ||
                invitation.company.deletedAt
            ) {
                throw new AppError(
                    404,
                    "Company invitation not found or this link is no longer valid.",
                );
            }

            if (invitation.company.suspendedAt) {
                throw new AppError(
                    403,
                    "This company workspace is currently unavailable. Contact JobsSpot support for assistance.",
                );
            }

            assertInvitationCanBeAccepted(
                invitation,
                acceptedAt,
            );

            const user =
                await transaction.user.findFirst({
                    where: {
                        id: actorUserId,
                        deletedAt: null,
                    },
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatarUrl: true,
                        isEmailVerified: true,
                    },
                });

            if (!user) {
                throw new AppError(
                    401,
                    "Authenticated user no longer exists.",
                );
            }

            if (!user.isEmailVerified) {
                throw new AppError(
                    403,
                    "Verify your email address before accepting this invitation.",
                );
            }

            if (
                normalizeEmail(user.email) !==
                normalizeEmail(invitation.email)
            ) {
                throw new AppError(
                    403,
                    "Sign in with the email address that received this company invitation.",
                    {
                        details: {
                            invitedEmailMasked:
                                maskEmail(
                                    invitation.email,
                                ),
                            invitationStatus:
                                "PENDING",
                        },
                    },
                );
            }

            await lockCompanyMembership(
                transaction,
                invitation.companyId,
                user.id,
            );

            const existingMembership =
                await transaction.companyMembership.findUnique({
                    where: {
                        companyId_userId: {
                            companyId:
                                invitation.companyId,
                            userId: user.id,
                        },
                    },
                    select: {
                        id: true,
                        role: true,
                        joinedAt: true,
                        deletedAt: true,
                    },
                });

            let membershipOutcome: MembershipOutcome;

            const membership =
                existingMembership
                    ? existingMembership.deletedAt
                        ? await transaction.companyMembership.update({
                              where: {
                                  id: existingMembership.id,
                              },
                              data: {
                                  role: invitation.role,
                                  joinedAt: acceptedAt,
                                  deletedAt: null,
                              },
                              select: {
                                  id: true,
                                  role: true,
                                  joinedAt: true,
                              },
                          })
                        : {
                              id: existingMembership.id,
                              role: existingMembership.role,
                              joinedAt:
                                  existingMembership.joinedAt,
                          }
                    : await transaction.companyMembership.create({
                          data: {
                              companyId:
                                  invitation.companyId,
                              userId: user.id,
                              role: invitation.role,
                              joinedAt: acceptedAt,
                          },
                          select: {
                              id: true,
                              role: true,
                              joinedAt: true,
                          },
                      });

            if (!existingMembership) {
                membershipOutcome = "CREATED";
            } else if (existingMembership.deletedAt) {
                membershipOutcome = "RESTORED";
            } else {
                membershipOutcome =
                    "ALREADY_ACTIVE";
            }

            const acceptedInvitation =
                await transaction.companyInvitation.update({
                    where: {
                        id: invitation.id,
                    },
                    data: {
                        acceptedAt,
                        acceptedById: user.id,
                    },
                    select: {
                        acceptedAt: true,
                    },
                });

            await createCompanyAuditLog({
                transaction,
                companyId: invitation.companyId,
                actorUserId: user.id,
                action:
                    AuditAction.COMPANY_INVITATION_ACCEPTED,
                entityType:
                    AuditEntityType.COMPANY_INVITATION,
                entityId: invitation.id,
                metadata: {
                    invitationId: invitation.id,
                    membershipId: membership.id,
                    targetUserId: user.id,
                    targetDisplayName:
                        getDisplayName(
                            user.firstName,
                            user.lastName,
                        ),
                    targetEmail: user.email,
                    invitedRole: invitation.role,
                    assignedRole: membership.role,
                    membershipOutcome,
                    companyId:
                        invitation.company.id,
                    companyName:
                        invitation.company.name,
                    acceptedAt:
                        acceptedInvitation.acceptedAt?.toISOString() ??
                        acceptedAt.toISOString(),
                },
            });

            return {
                invitation: {
                    status: "ACCEPTED" as const,
                    acceptedAt:
                        acceptedInvitation.acceptedAt ??
                        acceptedAt,
                    invitedRole:
                        invitation.role,
                    company: {
                        id: invitation.company.id,
                        name: invitation.company.name,
                        slug: invitation.company.slug,
                        logoUrl:
                            invitation.company.logoUrl,
                    },
                },
                membership: {
                    id: membership.id,
                    role: membership.role,
                    joinedAt:
                        membership.joinedAt,
                    outcome: membershipOutcome,
                    user: {
                        id: user.id,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        email: user.email,
                        avatarUrl:
                            user.avatarUrl,
                    },
                },
            };
        },
    );
}
