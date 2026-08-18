import { z } from "zod";

import { JobReportReason } from "../../generated/prisma/client.js";

export const createJobReportSchema = z
    .object({
        jobId: z.uuid("A valid job ID is required."),
        reason: z.enum(JobReportReason),
        details: z.string().trim().max(1500, "Report details must not exceed 1,500 characters.").optional(),
    })
    .strict()
    .superRefine((value, context) => {
        if (value.reason === JobReportReason.OTHER && (!value.details || value.details.length < 10)) {
            context.addIssue({
                code: "custom",
                path: ["details"],
                message: "Please add a short description of the concern.",
            });
        }
    });

export type CreateJobReportInput = z.infer<typeof createJobReportSchema>;
