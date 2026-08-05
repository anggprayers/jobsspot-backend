import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";

import type {
    CreateCertificationBody,
    UpdateCertificationBody,
} from "./job-seeker-certification.validation.js";

const MAX_CERTIFICATIONS_PER_PROFILE = 50;

const certificationSelect = {
    id: true,
    name: true,
    issuingOrganization: true,
    issueDate: true,
    expirationDate: true,
    credentialId: true,
    credentialUrl: true,
    displayOrder: true,
    createdAt: true,
    updatedAt: true,
} as const;

type CreateUserCertificationInput = {
    userId: string;
    data: CreateCertificationBody;
};

type UpdateUserCertificationInput = {
    userId: string;
    certificationId: string;
    data: UpdateCertificationBody;
};

type DeleteUserCertificationInput = {
    userId: string;
    certificationId: string;
};

async function getOrCreateJobSeekerProfileId(
    userId: string,
): Promise<string> {
    const profile = await prisma.jobSeekerProfile.upsert({
        where: {
            userId,
        },

        create: {
            userId,
        },

        update: {},

        select: {
            id: true,
        },
    });

    return profile.id;
}

async function getExistingJobSeekerProfileId(
    userId: string,
): Promise<string | null> {
    const profile = await prisma.jobSeekerProfile.findUnique({
        where: {
            userId,
        },

        select: {
            id: true,
        },
    });

    return profile?.id ?? null;
}

async function findOwnedCertification(
    userId: string,
    certificationId: string,
) {
    const certification = await prisma.certification.findFirst({
        where: {
            id: certificationId,

            profile: {
                userId,
            },
        },

        select: certificationSelect,
    });

    if (!certification) {
        throw new AppError(404, "Certification not found.");
    }

    return certification;
}

export async function listUserCertifications(userId: string) {
    const profileId = await getExistingJobSeekerProfileId(userId);

    if (!profileId) {
        return [];
    }

    return prisma.certification.findMany({
        where: {
            profileId,
        },

        select: certificationSelect,

        orderBy: [
            {
                issueDate: "desc",
            },
            {
                displayOrder: "asc",
            },
            {
                createdAt: "desc",
            },
        ],
    });
}

export async function createUserCertification({
    userId,
    data,
}: CreateUserCertificationInput) {
    const profileId = await getOrCreateJobSeekerProfileId(userId);

    const certificationCount = await prisma.certification.count({
        where: {
            profileId,
        },
    });

    if (certificationCount >= MAX_CERTIFICATIONS_PER_PROFILE) {
        throw new AppError(
            400,
            `You can add up to ${MAX_CERTIFICATIONS_PER_PROFILE} certifications.`,
        );
    }

    const highestDisplayOrder = await prisma.certification.aggregate({
        where: {
            profileId,
        },

        _max: {
            displayOrder: true,
        },
    });

    const displayOrder =
        (highestDisplayOrder._max.displayOrder ?? -1) + 1;

    return prisma.certification.create({
        data: {
            profileId,
            name: data.name,
            issuingOrganization: data.issuingOrganization ?? null,
            issueDate: data.issueDate ?? null,
            expirationDate: data.expirationDate ?? null,
            credentialId: data.credentialId ?? null,
            credentialUrl: data.credentialUrl ?? null,
            displayOrder,
        },

        select: certificationSelect,
    });
}

export async function updateUserCertification({
    userId,
    certificationId,
    data,
}: UpdateUserCertificationInput) {
    const existingCertification = await findOwnedCertification(
        userId,
        certificationId,
    );

    const nextIssueDate =
        data.issueDate !== undefined
            ? data.issueDate
            : existingCertification.issueDate;

    const nextExpirationDate =
        data.expirationDate !== undefined
            ? data.expirationDate
            : existingCertification.expirationDate;

    if (
        nextIssueDate &&
        nextExpirationDate &&
        nextExpirationDate < nextIssueDate
    ) {
        throw new AppError(
            400,
            "Expiration date cannot be earlier than issue date.",
        );
    }

    return prisma.certification.update({
        where: {
            id: existingCertification.id,
        },

        data: {
            ...(data.name !== undefined && {
                name: data.name,
            }),

            ...(data.issuingOrganization !== undefined && {
                issuingOrganization: data.issuingOrganization,
            }),

            ...(data.issueDate !== undefined && {
                issueDate: data.issueDate,
            }),

            ...(data.expirationDate !== undefined && {
                expirationDate: data.expirationDate,
            }),

            ...(data.credentialId !== undefined && {
                credentialId: data.credentialId,
            }),

            ...(data.credentialUrl !== undefined && {
                credentialUrl: data.credentialUrl,
            }),
        },

        select: certificationSelect,
    });
}

export async function deleteUserCertification({
    userId,
    certificationId,
}: DeleteUserCertificationInput) {
    const certification = await findOwnedCertification(
        userId,
        certificationId,
    );

    await prisma.certification.delete({
        where: {
            id: certification.id,
        },
    });

    return {
        id: certification.id,
    };
}
