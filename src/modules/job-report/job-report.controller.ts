import type { Request, Response } from "express";

import { AppError } from "../../errors/AppError.js";

import { createJobReport } from "./job-report.service.js";
import type { CreateJobReportInput } from "./job-report.validation.js";

function getAuthenticatedUserId(request: Request): string {
    if (!request.user) {
        throw new AppError(401, "Authentication is required.");
    }

    return request.user.id;
}

export async function createJobReportController(request: Request, response: Response): Promise<void> {
    const report = await createJobReport({
        reporterUserId: getAuthenticatedUserId(request),
        data: request.body as CreateJobReportInput,
    });

    response.status(201).json({
        success: true,
        message: "Thanks for letting us know. Your report was sent to the JobsSpot moderation team.",
        report,
    });
}
