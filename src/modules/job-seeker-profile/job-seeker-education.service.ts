import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";

import type {
    CreateEducationBody,
    UpdateEducationBody,
} from "./job-seeker-education.validation.js";

const MAX_EDUCATION_RECORDS_PER_PROFILE = 30;

const educationSelect = {
    id: true,
    institutionName: true,
    degree: true,
    fieldOfStudy: true,
    startDate: true,
    endDate: true,
    isCurrent: true,
    description: true,
    displayOrder: true,
    createdAt: true,
    updatedAt: true,
} as const;

type CreateUserEducationInput = {
    userId: string;
    data: CreateEducationBody;
};

type UpdateUserEducationInput = {
    userId: string;
    educationId: string;
    data: UpdateEducationBody;
};

type DeleteUserEducationInput = {
    userId: string;
    educationId: string;
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

async function findOwnedEducation(userId: string, educationId: string) {
    const education = await prisma.education.findFirst({
        where: {
            id: educationId,

            profile: {
                userId,
            },
        },

        select: educationSelect,
    });

    if (!education) {
        throw new AppError(404, "Education record not found.");
    }

    return education;
}

export async function listUserEducation(userId: string) {
    const profileId = await getExistingJobSeekerProfileId(userId);

    if (!profileId) {
        return [];
    }

    return prisma.education.findMany({
        where: {
            profileId,
        },

        select: educationSelect,

        orderBy: [
            {
                isCurrent: "desc",
            },
            {
                endDate: "desc",
            },
            {
                startDate: "desc",
            },
            {
                displayOrder: "asc",
            },
        ],
    });
}

export async function createUserEducation({
    userId,
    data,
}: CreateUserEducationInput) {
    const profileId = await getOrCreateJobSeekerProfileId(userId);

    const educationCount = await prisma.education.count({
        where: {
            profileId,
        },
    });

    if (educationCount >= MAX_EDUCATION_RECORDS_PER_PROFILE) {
        throw new AppError(
            400,
            `You can add up to ${MAX_EDUCATION_RECORDS_PER_PROFILE} education records.`,
        );
    }

    const highestDisplayOrder = await prisma.education.aggregate({
        where: {
            profileId,
        },

        _max: {
            displayOrder: true,
        },
    });

    const displayOrder =
        (highestDisplayOrder._max.displayOrder ?? -1) + 1;

    return prisma.education.create({
        data: {
            profileId,
            institutionName: data.institutionName,
            degree: data.degree ?? null,
            fieldOfStudy: data.fieldOfStudy ?? null,
            startDate: data.startDate ?? null,
            endDate: data.isCurrent ? null : (data.endDate ?? null),
            isCurrent: data.isCurrent,
            description: data.description ?? null,
            displayOrder,
        },

        select: educationSelect,
    });
}

export async function updateUserEducation({
    userId,
    educationId,
    data,
}: UpdateUserEducationInput) {
    const existingEducation = await findOwnedEducation(
        userId,
        educationId,
    );

    const nextStartDate =
        data.startDate !== undefined
            ? data.startDate
            : existingEducation.startDate;

    const nextIsCurrent =
        data.isCurrent ?? existingEducation.isCurrent;

    const requestedEndDate =
        data.endDate !== undefined
            ? data.endDate
            : existingEducation.endDate;

    const nextEndDate = nextIsCurrent ? null : requestedEndDate;

    if (
        nextStartDate &&
        nextEndDate &&
        nextEndDate < nextStartDate
    ) {
        throw new AppError(
            400,
            "End date cannot be earlier than start date.",
        );
    }

    return prisma.education.update({
        where: {
            id: existingEducation.id,
        },

        data: {
            ...(data.institutionName !== undefined && {
                institutionName: data.institutionName,
            }),

            ...(data.degree !== undefined && {
                degree: data.degree,
            }),

            ...(data.fieldOfStudy !== undefined && {
                fieldOfStudy: data.fieldOfStudy,
            }),

            ...(data.startDate !== undefined && {
                startDate: data.startDate,
            }),

            endDate: nextEndDate,

            ...(data.isCurrent !== undefined && {
                isCurrent: data.isCurrent,
            }),

            ...(data.description !== undefined && {
                description: data.description,
            }),
        },

        select: educationSelect,
    });
}

export async function deleteUserEducation({
    userId,
    educationId,
}: DeleteUserEducationInput) {
    const education = await findOwnedEducation(userId, educationId);

    await prisma.education.delete({
        where: {
            id: education.id,
        },
    });

    return {
        id: education.id,
    };
}
