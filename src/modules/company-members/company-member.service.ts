import { CompanyMemberRole } from "../../generated/prisma/client.js";

import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";

import { AuditAction, AuditEntityType } from "../audit-log/audit-log.constants.js";
import { createCompanyAuditLog } from "../audit-log/audit-log.service.js";

import type {
    AddCompanyMemberInput,
    SearchCompanyMemberCandidatesInput,
    UpdateCompanyMemberRoleInput,
} from "./company-member.validation.js";

async function getManagingMemberRole(companyId: string, actorUserId: string): Promise<CompanyMemberRole> {
    const company = await prisma.company.findFirst({
        where: {
            id: companyId,
            deletedAt: null,
        },

        select: {
            id: true,
        },
    });

    if (!company) {
        throw new AppError(404, "Company not found.");
    }

    const actorMembership = await prisma.companyMembership.findFirst({
        where: {
            companyId,
            userId: actorUserId,
            deletedAt: null,
        },

        select: {
            role: true,
        },
    });

    if (!actorMembership) {
        throw new AppError(403, "You are not a member of this company.");
    }

    if (actorMembership.role !== CompanyMemberRole.OWNER && actorMembership.role !== CompanyMemberRole.ADMIN) {
        throw new AppError(403, "You do not have permission to manage company members.");
    }

    return actorMembership.role;
}

function assertCanAssignRole(actorRole: CompanyMemberRole, targetRole: CompanyMemberRole): void {
    if (actorRole === CompanyMemberRole.ADMIN && targetRole === CompanyMemberRole.ADMIN) {
        throw new AppError(403, "Only the company owner can assign the admin role.");
    }
}

function getMemberDisplayName(firstName: string, lastName: string): string {
    return `${firstName} ${lastName}`.trim();
}

export async function getCompanyMembers(companyId: string) {
    const company = await prisma.company.findFirst({
        where: {
            id: companyId,
            deletedAt: null,
        },

        select: {
            id: true,
        },
    });

    if (!company) {
        throw new AppError(404, "Company not found.");
    }

    return prisma.companyMembership.findMany({
        where: {
            companyId,
            deletedAt: null,
        },

        orderBy: {
            joinedAt: "asc",
        },

        select: {
            id: true,
            role: true,
            joinedAt: true,

            user: {
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                    avatarUrl: true,
                },
            },
        },
    });
}

type SearchCompanyMemberCandidatesParameters = {
    companyId: string;
    actorUserId: string;
    query: SearchCompanyMemberCandidatesInput["query"];
};

export async function searchCompanyMemberCandidates({
    companyId,
    actorUserId,
    query,
}: SearchCompanyMemberCandidatesParameters) {
    await getManagingMemberRole(companyId, actorUserId);

    const existingMemberships = await prisma.companyMembership.findMany({
        where: {
            companyId,
            deletedAt: null,
        },

        select: {
            userId: true,
        },
    });

    const excludedUserIds = existingMemberships.map((membership) => membership.userId);

    return prisma.user.findMany({
        where: {
            deletedAt: null,

            ...(excludedUserIds.length > 0
                ? {
                      id: {
                          notIn: excludedUserIds,
                      },
                  }
                : {}),

            OR: [
                {
                    email: {
                        contains: query,
                        mode: "insensitive",
                    },
                },
                {
                    firstName: {
                        contains: query,
                        mode: "insensitive",
                    },
                },
                {
                    lastName: {
                        contains: query,
                        mode: "insensitive",
                    },
                },
            ],
        },

        orderBy: [
            {
                firstName: "asc",
            },
            {
                lastName: "asc",
            },
        ],

        take: 8,

        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
        },
    });
}

type AddCompanyMemberParameters = {
    companyId: string;
    actorUserId: string;
    data: AddCompanyMemberInput;
};

export async function addCompanyMember({ companyId, actorUserId, data }: AddCompanyMemberParameters) {
    const actorRole = await getManagingMemberRole(companyId, actorUserId);

    assertCanAssignRole(actorRole, data.role);

    const user = await prisma.user.findFirst({
        where: {
            email: data.email,
            deletedAt: null,
        },

        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatarUrl: true,
        },
    });

    if (!user) {
        throw new AppError(404, "No JobsSpot account exists with this email address.");
    }

    return prisma.$transaction(async (transaction) => {
        const existingMembership = await transaction.companyMembership.findUnique({
            where: {
                companyId_userId: {
                    companyId,
                    userId: user.id,
                },
            },

            select: {
                id: true,
                deletedAt: true,
            },
        });

        if (existingMembership && !existingMembership.deletedAt) {
            throw new AppError(409, "This user is already a member of the company.");
        }

        const membership = existingMembership
            ? await transaction.companyMembership.update({
                  where: {
                      id: existingMembership.id,
                  },

                  data: {
                      role: data.role,
                      joinedAt: new Date(),
                      deletedAt: null,
                  },

                  select: {
                      id: true,
                      role: true,
                      joinedAt: true,

                      user: {
                          select: {
                              id: true,
                              firstName: true,
                              lastName: true,
                              email: true,
                              avatarUrl: true,
                          },
                      },
                  },
              })
            : await transaction.companyMembership.create({
                  data: {
                      companyId,
                      userId: user.id,
                      role: data.role,
                  },

                  select: {
                      id: true,
                      role: true,
                      joinedAt: true,

                      user: {
                          select: {
                              id: true,
                              firstName: true,
                              lastName: true,
                              email: true,
                              avatarUrl: true,
                          },
                      },
                  },
              });

        await createCompanyAuditLog({
            transaction,
            companyId,
            actorUserId,
            action: AuditAction.COMPANY_MEMBER_ADDED,
            entityType: AuditEntityType.COMPANY_MEMBERSHIP,
            entityId: membership.id,

            metadata: {
                membershipId: membership.id,
                targetUserId: user.id,
                targetDisplayName: getMemberDisplayName(user.firstName, user.lastName),
                targetEmail: user.email,
                assignedRole: membership.role,
            },
        });

        return membership;
    });
}

type UpdateCompanyMemberRoleParameters = {
    companyId: string;
    memberId: string;
    actorUserId: string;
    data: UpdateCompanyMemberRoleInput;
};

export async function updateCompanyMemberRole({
    companyId,
    memberId,
    actorUserId,
    data,
}: UpdateCompanyMemberRoleParameters) {
    const actorRole = await getManagingMemberRole(companyId, actorUserId);

    assertCanAssignRole(actorRole, data.role);

    return prisma.$transaction(async (transaction) => {
        const existingMember = await transaction.companyMembership.findFirst({
            where: {
                id: memberId,
                companyId,
                deletedAt: null,
            },

            select: {
                id: true,
                userId: true,
                role: true,

                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
        });

        if (!existingMember) {
            throw new AppError(404, "Company member not found.");
        }

        if (existingMember.role === CompanyMemberRole.OWNER) {
            throw new AppError(403, "The company owner's role cannot be changed.");
        }

        if (existingMember.userId === actorUserId) {
            throw new AppError(403, "You cannot change your own role.");
        }

        if (actorRole === CompanyMemberRole.ADMIN && existingMember.role === CompanyMemberRole.ADMIN) {
            throw new AppError(403, "Only the company owner can manage another admin.");
        }

        if (existingMember.role === data.role) {
            throw new AppError(
                409,
                `This member already has the ${data.role.toLowerCase().replaceAll("_", " ")} role.`,
            );
        }

        const previousRole = existingMember.role;

        const updatedMember = await transaction.companyMembership.update({
            where: {
                id: existingMember.id,
            },

            data: {
                role: data.role,
            },

            select: {
                id: true,
                role: true,
                joinedAt: true,

                user: {
                    select: {
                        id: true,
                        firstName: true,
                        lastName: true,
                        email: true,
                        avatarUrl: true,
                    },
                },
            },
        });

        await createCompanyAuditLog({
            transaction,
            companyId,
            actorUserId,
            action: AuditAction.COMPANY_MEMBER_ROLE_CHANGED,
            entityType: AuditEntityType.COMPANY_MEMBERSHIP,
            entityId: updatedMember.id,

            metadata: {
                membershipId: updatedMember.id,
                targetUserId: updatedMember.user.id,
                targetDisplayName: getMemberDisplayName(updatedMember.user.firstName, updatedMember.user.lastName),
                targetEmail: updatedMember.user.email,
                previousRole,
                newRole: updatedMember.role,
            },
        });

        return updatedMember;
    });
}

type RemoveCompanyMemberParameters = {
    companyId: string;
    memberId: string;
    actorUserId: string;
};

export async function removeCompanyMember({ companyId, memberId, actorUserId }: RemoveCompanyMemberParameters) {
    const actorRole = await getManagingMemberRole(companyId, actorUserId);

    await prisma.$transaction(async (transaction) => {
        const existingMember = await transaction.companyMembership.findFirst({
            where: {
                id: memberId,
                companyId,
                deletedAt: null,
            },

            select: {
                id: true,
                userId: true,
                role: true,

                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        email: true,
                    },
                },
            },
        });

        if (!existingMember) {
            throw new AppError(404, "Company member not found.");
        }

        if (existingMember.role === CompanyMemberRole.OWNER) {
            throw new AppError(403, "The company owner cannot be removed.");
        }

        if (existingMember.userId === actorUserId) {
            throw new AppError(403, "You cannot remove yourself from the team.");
        }

        if (actorRole === CompanyMemberRole.ADMIN && existingMember.role === CompanyMemberRole.ADMIN) {
            throw new AppError(403, "Only the company owner can remove another admin.");
        }

        const removedRole = existingMember.role;

        await transaction.companyMembership.update({
            where: {
                id: existingMember.id,
            },

            data: {
                deletedAt: new Date(),
            },
        });

        await createCompanyAuditLog({
            transaction,
            companyId,
            actorUserId,
            action: AuditAction.COMPANY_MEMBER_REMOVED,
            entityType: AuditEntityType.COMPANY_MEMBERSHIP,
            entityId: existingMember.id,

            metadata: {
                membershipId: existingMember.id,
                targetUserId: existingMember.userId,
                targetDisplayName: getMemberDisplayName(existingMember.user.firstName, existingMember.user.lastName),
                targetEmail: existingMember.user.email,
                removedRole,
            },
        });
    });
}
