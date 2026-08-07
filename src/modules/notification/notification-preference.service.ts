import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";

import type { UpdateNotificationPreferencesInput } from "./notification.validation.js";

export const DEFAULT_NOTIFICATION_PREFERENCES = {
    jobSeekerApplicationUpdatesEmail: true,
    jobSeekerApplicationViewedEmail: false,
    employerApplicationEmail: true,
    employerTeamEmail: true,
    employerJobEmail: true,
    systemEmail: true,
} as const;

const notificationPreferenceSelect = {
    jobSeekerApplicationUpdatesEmail: true,
    jobSeekerApplicationViewedEmail: true,
    employerApplicationEmail: true,
    employerTeamEmail: true,
    employerJobEmail: true,
    systemEmail: true,
    updatedAt: true,
} satisfies Prisma.NotificationPreferenceSelect;

function buildPreferenceUpdateData(
    input: UpdateNotificationPreferencesInput,
): Prisma.NotificationPreferenceUpdateInput {
    return {
        ...(input.jobSeekerApplicationUpdatesEmail !== undefined && {
            jobSeekerApplicationUpdatesEmail:
                input.jobSeekerApplicationUpdatesEmail,
        }),
        ...(input.jobSeekerApplicationViewedEmail !== undefined && {
            jobSeekerApplicationViewedEmail:
                input.jobSeekerApplicationViewedEmail,
        }),
        ...(input.employerApplicationEmail !== undefined && {
            employerApplicationEmail: input.employerApplicationEmail,
        }),
        ...(input.employerTeamEmail !== undefined && {
            employerTeamEmail: input.employerTeamEmail,
        }),
        ...(input.employerJobEmail !== undefined && {
            employerJobEmail: input.employerJobEmail,
        }),
        ...(input.systemEmail !== undefined && {
            systemEmail: input.systemEmail,
        }),
    };
}

export async function getNotificationPreferences(userId: string) {
    return prisma.notificationPreference.upsert({
        where: { userId },
        update: {},
        create: {
            userId,
            ...DEFAULT_NOTIFICATION_PREFERENCES,
        },
        select: notificationPreferenceSelect,
    });
}

export async function updateNotificationPreferences(
    userId: string,
    input: UpdateNotificationPreferencesInput,
) {
    const updateData = buildPreferenceUpdateData(input);

    return prisma.notificationPreference.upsert({
        where: { userId },
        update: updateData,
        create: {
            userId,
            jobSeekerApplicationUpdatesEmail:
                input.jobSeekerApplicationUpdatesEmail ??
                DEFAULT_NOTIFICATION_PREFERENCES.jobSeekerApplicationUpdatesEmail,
            jobSeekerApplicationViewedEmail:
                input.jobSeekerApplicationViewedEmail ??
                DEFAULT_NOTIFICATION_PREFERENCES.jobSeekerApplicationViewedEmail,
            employerApplicationEmail:
                input.employerApplicationEmail ??
                DEFAULT_NOTIFICATION_PREFERENCES.employerApplicationEmail,
            employerTeamEmail:
                input.employerTeamEmail ??
                DEFAULT_NOTIFICATION_PREFERENCES.employerTeamEmail,
            employerJobEmail:
                input.employerJobEmail ??
                DEFAULT_NOTIFICATION_PREFERENCES.employerJobEmail,
            systemEmail:
                input.systemEmail ??
                DEFAULT_NOTIFICATION_PREFERENCES.systemEmail,
        },
        select: notificationPreferenceSelect,
    });
}
