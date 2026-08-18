import { z } from "zod";

import { NotificationAudience } from "../../generated/prisma/client.js";

export const notificationAudienceSchema = z.nativeEnum(NotificationAudience);

export const notificationListQuerySchema = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    status: z.enum(["ALL", "UNREAD", "READ"]).default("ALL"),
    audience: notificationAudienceSchema.optional(),
});

export const notificationUnreadCountQuerySchema = z.object({
    audience: notificationAudienceSchema.optional(),
});

export const notificationUuidParamsSchema = z.object({
    notificationId: z.uuid("A valid notification ID is required."),
});

export const markAllNotificationsReadSchema = z.object({
    audience: notificationAudienceSchema.optional(),
});

export const clearReadNotificationsSchema = z.object({
    audience: z.enum(["JOB_SEEKER", "EMPLOYER", "ADMIN"]),
});


export const updateNotificationPreferencesSchema = z
    .object({
        jobSeekerApplicationUpdatesEmail: z.boolean().optional(),
        systemEmail: z.boolean().optional(),
    })
    .refine(
        (value) => Object.keys(value).length > 0,
        "At least one notification preference is required.",
    );

export type NotificationListQuery = z.infer<
    typeof notificationListQuerySchema
>;

export type NotificationUnreadCountQuery = z.infer<
    typeof notificationUnreadCountQuerySchema
>;

export type MarkAllNotificationsReadInput = z.infer<
    typeof markAllNotificationsReadSchema
>;

export type ClearReadNotificationsInput = z.infer<
    typeof clearReadNotificationsSchema
>;

export type UpdateNotificationPreferencesInput = z.infer<
    typeof updateNotificationPreferencesSchema
>;
