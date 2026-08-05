import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { createSlug } from "../../utils/slug.js";

import type {
    AddJobSeekerSkillBody,
    CreateWorkExperienceBody,
    UpdateJobSeekerProfileBody,
    UpdateJobSeekerSkillBody,
    UpdateWorkExperienceBody,
} from "./job-seeker-profile.validation.js";

const MAX_SKILLS_PER_PROFILE = 30;
const MAX_WORK_EXPERIENCES_PER_PROFILE = 50;

const jobSeekerProfileSelect = {
    id: true,
    userId: true,
    headline: true,
    summary: true,
    location: true,
    websiteUrl: true,
    linkedInUrl: true,
    yearsOfExperience: true,
    createdAt: true,
    updatedAt: true,
} as const;

const jobSeekerSkillSelect = {
    skillId: true,
    yearsOfExperience: true,
    createdAt: true,

    skill: {
        select: {
            id: true,
            name: true,
            slug: true,
        },
    },
} as const;

const workExperienceSelect = {
    id: true,
    jobTitle: true,
    companyName: true,
    employmentType: true,
    location: true,
    startDate: true,
    endDate: true,
    isCurrent: true,
    description: true,
    displayOrder: true,
    createdAt: true,
    updatedAt: true,
} as const;

type UpdateUserJobSeekerProfileInput = {
    userId: string;
    data: UpdateJobSeekerProfileBody;
};

type AddUserJobSeekerSkillInput = {
    userId: string;
    data: AddJobSeekerSkillBody;
};

type UpdateUserJobSeekerSkillInput = {
    userId: string;
    skillId: string;
    data: UpdateJobSeekerSkillBody;
};

type DeleteUserJobSeekerSkillInput = {
    userId: string;
    skillId: string;
};

type CreateUserWorkExperienceInput = {
    userId: string;
    data: CreateWorkExperienceBody;
};

type UpdateUserWorkExperienceInput = {
    userId: string;
    experienceId: string;
    data: UpdateWorkExperienceBody;
};

type DeleteUserWorkExperienceInput = {
    userId: string;
    experienceId: string;
};

type SelectedJobSeekerSkill = {
    skillId: string;
    yearsOfExperience: number | null;
    createdAt: Date;
    skill: {
        id: string;
        name: string;
        slug: string;
    };
};

function createProfileData(data: UpdateJobSeekerProfileBody) {
    return {
        ...(data.headline !== undefined && {
            headline: data.headline,
        }),

        ...(data.summary !== undefined && {
            summary: data.summary,
        }),

        ...(data.location !== undefined && {
            location: data.location,
        }),

        ...(data.websiteUrl !== undefined && {
            websiteUrl: data.websiteUrl,
        }),

        ...(data.linkedInUrl !== undefined && {
            linkedInUrl: data.linkedInUrl,
        }),

        ...(data.yearsOfExperience !== undefined && {
            yearsOfExperience: data.yearsOfExperience,
        }),
    };
}

function normalizeSkillName(value: string): string {
    const normalizedName = value.trim().replace(/\s+/g, " ");

    if (!normalizedName) {
        throw new AppError(400, "Skill name is required.");
    }

    return normalizedName;
}

function serializeJobSeekerSkill(record: SelectedJobSeekerSkill) {
    return {
        id: record.skill.id,
        name: record.skill.name,
        slug: record.skill.slug,
        yearsOfExperience: record.yearsOfExperience,
        createdAt: record.createdAt,
    };
}

async function getOrCreateJobSeekerProfileId(userId: string): Promise<string> {
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

async function findOwnedWorkExperience(
    userId: string,
    experienceId: string,
) {
    const experience = await prisma.workExperience.findFirst({
        where: {
            id: experienceId,

            profile: {
                userId,
            },
        },

        select: workExperienceSelect,
    });

    if (!experience) {
        throw new AppError(404, "Work experience not found.");
    }

    return experience;
}

export async function getUserJobSeekerProfile(userId: string) {
    return prisma.jobSeekerProfile.findUnique({
        where: {
            userId,
        },

        select: jobSeekerProfileSelect,
    });
}

export async function updateUserJobSeekerProfile({
    userId,
    data,
}: UpdateUserJobSeekerProfileInput) {
    const profileData = createProfileData(data);

    return prisma.jobSeekerProfile.upsert({
        where: {
            userId,
        },

        create: {
            userId,
            ...profileData,
        },

        update: profileData,

        select: jobSeekerProfileSelect,
    });
}

export async function listUserJobSeekerSkills(userId: string) {
    const profileId = await getExistingJobSeekerProfileId(userId);

    if (!profileId) {
        return [];
    }

    const skills = await prisma.jobSeekerSkill.findMany({
        where: {
            profileId,
        },

        select: jobSeekerSkillSelect,

        orderBy: {
            skill: {
                name: "asc",
            },
        },
    });

    return skills.map(serializeJobSeekerSkill);
}

export async function addUserJobSeekerSkill({
    userId,
    data,
}: AddUserJobSeekerSkillInput) {
    const profileId = await getOrCreateJobSeekerProfileId(userId);

    const skillCount = await prisma.jobSeekerSkill.count({
        where: {
            profileId,
        },
    });

    if (skillCount >= MAX_SKILLS_PER_PROFILE) {
        throw new AppError(
            400,
            `You can add up to ${MAX_SKILLS_PER_PROFILE} skills to your profile.`,
        );
    }

    const normalizedName = normalizeSkillName(data.name);
    const slug = createSlug(normalizedName);

    if (!slug) {
        throw new AppError(400, "Skill name must contain letters or numbers.");
    }

    const skill = await prisma.skill.upsert({
        where: {
            slug,
        },

        create: {
            name: normalizedName,
            slug,
        },

        update: {},

        select: {
            id: true,
        },
    });

    const existingProfileSkill = await prisma.jobSeekerSkill.findUnique({
        where: {
            profileId_skillId: {
                profileId,
                skillId: skill.id,
            },
        },

        select: {
            skillId: true,
        },
    });

    if (existingProfileSkill) {
        throw new AppError(409, "This skill is already added to your profile.");
    }

    const profileSkill = await prisma.jobSeekerSkill.create({
        data: {
            profileId,
            skillId: skill.id,

            ...(data.yearsOfExperience !== undefined && {
                yearsOfExperience: data.yearsOfExperience,
            }),
        },

        select: jobSeekerSkillSelect,
    });

    return serializeJobSeekerSkill(profileSkill);
}

export async function updateUserJobSeekerSkill({
    userId,
    skillId,
    data,
}: UpdateUserJobSeekerSkillInput) {
    const profileId = await getExistingJobSeekerProfileId(userId);

    if (!profileId) {
        throw new AppError(404, "Skill not found.");
    }

    const existingProfileSkill = await prisma.jobSeekerSkill.findUnique({
        where: {
            profileId_skillId: {
                profileId,
                skillId,
            },
        },

        select: {
            skillId: true,
        },
    });

    if (!existingProfileSkill) {
        throw new AppError(404, "Skill not found.");
    }

    const profileSkill = await prisma.jobSeekerSkill.update({
        where: {
            profileId_skillId: {
                profileId,
                skillId,
            },
        },

        data: {
            yearsOfExperience: data.yearsOfExperience,
        },

        select: jobSeekerSkillSelect,
    });

    return serializeJobSeekerSkill(profileSkill);
}

export async function deleteUserJobSeekerSkill({
    userId,
    skillId,
}: DeleteUserJobSeekerSkillInput) {
    const profileId = await getExistingJobSeekerProfileId(userId);

    if (!profileId) {
        throw new AppError(404, "Skill not found.");
    }

    const deleteResult = await prisma.jobSeekerSkill.deleteMany({
        where: {
            profileId,
            skillId,
        },
    });

    if (deleteResult.count !== 1) {
        throw new AppError(404, "Skill not found.");
    }

    return {
        id: skillId,
    };
}

export async function listUserWorkExperiences(userId: string) {
    const profileId = await getExistingJobSeekerProfileId(userId);

    if (!profileId) {
        return [];
    }

    return prisma.workExperience.findMany({
        where: {
            profileId,
        },

        select: workExperienceSelect,

        orderBy: [
            {
                isCurrent: "desc",
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

export async function createUserWorkExperience({
    userId,
    data,
}: CreateUserWorkExperienceInput) {
    const profileId = await getOrCreateJobSeekerProfileId(userId);

    const experienceCount = await prisma.workExperience.count({
        where: {
            profileId,
        },
    });

    if (experienceCount >= MAX_WORK_EXPERIENCES_PER_PROFILE) {
        throw new AppError(
            400,
            `You can add up to ${MAX_WORK_EXPERIENCES_PER_PROFILE} work experiences.`,
        );
    }

    const highestDisplayOrder = await prisma.workExperience.aggregate({
        where: {
            profileId,
        },

        _max: {
            displayOrder: true,
        },
    });

    const displayOrder =
        (highestDisplayOrder._max.displayOrder ?? -1) + 1;

    return prisma.workExperience.create({
        data: {
            profileId,
            jobTitle: data.jobTitle,
            companyName: data.companyName,
            employmentType: data.employmentType ?? null,
            location: data.location ?? null,
            startDate: data.startDate,
            endDate: data.isCurrent ? null : (data.endDate ?? null),
            isCurrent: data.isCurrent,
            description: data.description ?? null,
            displayOrder,
        },

        select: workExperienceSelect,
    });
}

export async function updateUserWorkExperience({
    userId,
    experienceId,
    data,
}: UpdateUserWorkExperienceInput) {
    const existingExperience = await findOwnedWorkExperience(
        userId,
        experienceId,
    );

    const nextStartDate =
        data.startDate ?? existingExperience.startDate;

    const nextIsCurrent =
        data.isCurrent ?? existingExperience.isCurrent;

    const requestedEndDate =
        data.endDate !== undefined
            ? data.endDate
            : existingExperience.endDate;

    const nextEndDate = nextIsCurrent ? null : requestedEndDate;

    if (nextEndDate && nextEndDate < nextStartDate) {
        throw new AppError(
            400,
            "End date cannot be earlier than start date.",
        );
    }

    return prisma.workExperience.update({
        where: {
            id: existingExperience.id,
        },

        data: {
            ...(data.jobTitle !== undefined && {
                jobTitle: data.jobTitle,
            }),

            ...(data.companyName !== undefined && {
                companyName: data.companyName,
            }),

            ...(data.employmentType !== undefined && {
                employmentType: data.employmentType,
            }),

            ...(data.location !== undefined && {
                location: data.location,
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

        select: workExperienceSelect,
    });
}

export async function deleteUserWorkExperience({
    userId,
    experienceId,
}: DeleteUserWorkExperienceInput) {
    const experience = await findOwnedWorkExperience(
        userId,
        experienceId,
    );

    await prisma.workExperience.delete({
        where: {
            id: experience.id,
        },
    });

    return {
        id: experience.id,
    };
}
