import type { Request, Response } from "express";
import { z } from "zod";

import { AppError } from "../../errors/AppError.js";

import {
    createUserApplication,
    getUserApplicationById,
    getUserApplicationForJob,
    getUserApplicationResumeDownload,
    getUserApplications,
    withdrawUserApplication,
} from "./job-seeker-application.service.js";

import {
    jobSeekerApplicationsQuerySchema,
    type CreateJobApplicationInput,
} from "./job-seeker-application.validation.js";

const applicationIdSchema = z.uuid();
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

function getApplicationId(request: Request): string {
    const result = applicationIdSchema.safeParse(
        request.params.applicationId,
    );

    if (!result.success) {
        throw new AppError(
            400,
            "A valid application ID is required.",
        );
    }

    return result.data;
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

export async function createJobApplicationController(
    request: Request,
    response: Response,
): Promise<void> {
    const applicantId = getAuthenticatedUserId(request);
    const data = request.body as CreateJobApplicationInput;

    const application = await createUserApplication({
        applicantId,
        data,
    });

    response.status(201).json({
        success: true,
        message: "Application submitted successfully.",
        application,
    });
}

export async function getJobSeekerApplicationsController(
    request: Request,
    response: Response,
): Promise<void> {
    const applicantId = getAuthenticatedUserId(request);

    const query = jobSeekerApplicationsQuerySchema.parse(
        request.query,
    );

    const result = await getUserApplications({
        applicantId,
        ...query,
    });

    response.status(200).json({
        success: true,
        message: "Applications retrieved successfully.",
        ...result,
    });
}

export async function getJobSeekerApplicationByIdController(
    request: Request,
    response: Response,
): Promise<void> {
    const applicantId = getAuthenticatedUserId(request);
    const applicationId = getApplicationId(request);

    const application = await getUserApplicationById({
        applicantId,
        applicationId,
    });

    response.status(200).json({
        success: true,
        message: "Application retrieved successfully.",
        application,
    });
}

export async function getJobSeekerApplicationForJobController(
    request: Request,
    response: Response,
): Promise<void> {
    const applicantId = getAuthenticatedUserId(request);
    const jobId = getJobId(request);

    const application = await getUserApplicationForJob({
        applicantId,
        jobId,
    });

    response.status(200).json({
        success: true,
        application,
    });
}

export async function getJobSeekerApplicationResumeDownloadController(
    request: Request,
    response: Response,
): Promise<void> {
    const applicantId = getAuthenticatedUserId(request);
    const applicationId = getApplicationId(request);

    const download = await getUserApplicationResumeDownload({
        applicantId,
        applicationId,
    });

    response.status(200).json({
        success: true,
        ...download,
    });
}

export async function withdrawJobApplicationController(
    request: Request,
    response: Response,
): Promise<void> {
    const applicantId = getAuthenticatedUserId(request);
    const applicationId = getApplicationId(request);

    const application = await withdrawUserApplication({
        applicantId,
        applicationId,
    });

    response.status(200).json({
        success: true,
        message: "Application withdrawn successfully.",
        application,
    });
}
