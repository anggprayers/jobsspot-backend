import { Prisma } from "../../generated/prisma/client.js";
import { prisma } from "../../lib/prisma.js";

import type { UpdateNotificationPreferencesInput } from "./notification.validation.js";

// Legacy employer/viewed columns remain in the database until the employer
// portal is decommissioned. They are intentionally no longer exposed by the
// remodel notification-preferences API.
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
            ...DEFAULT_NOTIFICATION_PREFERENCES,
            jobSeekerApplicationUpdatesEmail:
                input.jobSeekerApplicationUpdatesEmail ??
                DEFAULT_NOTIFICATION_PREFERENCES.jobSeekerApplicationUpdatesEmail,
            systemEmail:
                input.systemEmail ?? DEFAULT_NOTIFICATION_PREFERENCES.systemEmail,
        },
        select: notificationPreferenceSelect,
    });
}
