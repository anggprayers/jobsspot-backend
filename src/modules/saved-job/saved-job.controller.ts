import type { Request, Response } from "express";
import { z } from "zod";

import { AppError } from "../../errors/AppError.js";

import {
    getUserSavedJobStatus,
    listUserSavedJobs,
    removeSavedJobForUser,
    saveJobForUser,
} from "./saved-job.service.js";

import { savedJobsQuerySchema } from "./saved-job.validation.js";

const jobIdSchema = z.uuid();

function getAuthenticatedUserId(request: Request): string {
    if (!request.user) {
        throw new AppError(
            401,
            "Authentication is required.",
        );
    }

    return request.user.id;
}

function getJobId(request: Request): string {
    const result = jobIdSchema.safeParse(request.params.jobId);

    if (!result.success) {
        throw new AppError(
            400,
            "A valid job ID is required.",
        );
    }

    return result.data;
}

export async function getSavedJobsController(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);

    const query = savedJobsQuerySchema.parse(request.query);

    const result = await listUserSavedJobs({
        userId,
        ...query,
    });

    response.status(200).json({
        success: true,
        message: "Saved jobs retrieved successfully.",
        ...result,
    });
}

export async function getSavedJobStatusController(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    const jobId = getJobId(request);

    const result = await getUserSavedJobStatus({
        userId,
        jobId,
    });

    response.status(200).json({
        success: true,
        ...result,
    });
}

export async function saveJobController(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    const jobId = getJobId(request);

    const savedJob = await saveJobForUser({
        userId,
        jobId,
    });

    response.status(201).json({
        success: true,
        message: "Job saved successfully.",
        savedJob,
    });
}

export async function removeSavedJobController(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    const jobId = getJobId(request);

    const result = await removeSavedJobForUser({
        userId,
        jobId,
    });

    response.status(200).json({
        success: true,
        message: "Job removed from saved jobs.",
        ...result,
    });
}
