import type { Request, Response } from "express";

import { AppError } from "../../errors/AppError.js";

import {
    archiveJob,
    createJob as createJobService,
    deleteJob,
    getCompanyJobById,
    getCompanyJobs,
    publishJob,
    renewJob,
    restoreJob,
    unpublishJob,
    updateJob,
} from "./job.service.js";

import { companyJobsQuerySchema, type CreateJobInput, type UpdateJobInput } from "./job.validation.js";

function getAuthenticatedUserId(request: Request): string {
    if (!request.user) {
        throw new AppError(401, "Authentication is required.");
    }

    return request.user.id;
}

export async function createJob(request: Request, response: Response): Promise<void> {
    const companyId = request.params.companyId;

    if (typeof companyId !== "string") {
        throw new AppError(400, "A valid company ID is required.");
    }

    const job = await createJobService({
        companyId,
        actorUserId: getAuthenticatedUserId(request),
        data: request.body as CreateJobInput,
    });

    response.status(201).json({
        success: true,
        message: "Job created successfully.",
        job,
    });
}

export async function getCompanyJobsController(request: Request, response: Response): Promise<void> {
    const companyId = request.params.companyId;

    if (typeof companyId !== "string") {
        throw new AppError(400, "A valid company ID is required.");
    }

    const query = companyJobsQuerySchema.parse(request.query);

    const result = await getCompanyJobs({
        companyId,

        ...(query.search !== undefined && {
            search: query.search,
        }),

        ...(query.status !== undefined && {
            status: query.status,
        }),

        page: query.page,
        limit: query.limit,
    });

    response.status(200).json({
        success: true,
        message: "Company jobs retrieved successfully.",
        ...result,
    });
}

export async function getCompanyJobByIdController(request: Request, response: Response): Promise<void> {
    const companyId = request.params.companyId;
    const jobId = request.params.jobId;

    if (typeof companyId !== "string") {
        throw new AppError(400, "A valid company ID is required.");
    }

    if (typeof jobId !== "string") {
        throw new AppError(400, "A valid job ID is required.");
    }

    const job = await getCompanyJobById(companyId, jobId);

    response.status(200).json({
        success: true,
        message: "Company job retrieved successfully.",
        job,
    });
}

export async function updateJobController(request: Request, response: Response): Promise<void> {
    const companyId = request.params.companyId;
    const jobId = request.params.jobId;

    if (typeof companyId !== "string") {
        throw new AppError(400, "A valid company ID is required.");
    }

    if (typeof jobId !== "string") {
        throw new AppError(400, "A valid job ID is required.");
    }

    const job = await updateJob({
        companyId,
        jobId,
        actorUserId: getAuthenticatedUserId(request),
        data: request.body as UpdateJobInput,
    });

    response.status(200).json({
        success: true,
        message: "Job updated successfully.",
        job,
    });
}

export async function deleteJobController(request: Request, response: Response): Promise<void> {
    const companyId = request.params.companyId;
    const jobId = request.params.jobId;

    if (typeof companyId !== "string") {
        throw new AppError(400, "A valid company ID is required.");
    }

    if (typeof jobId !== "string") {
        throw new AppError(400, "A valid job ID is required.");
    }

    await deleteJob({
        companyId,
        jobId,
        actorUserId: getAuthenticatedUserId(request),
    });

    response.status(200).json({
        success: true,
        message: "Job deleted successfully.",
    });
}

export async function publishJobController(request: Request, response: Response): Promise<void> {
    const companyId = request.params.companyId;
    const jobId = request.params.jobId;

    if (typeof companyId !== "string") {
        throw new AppError(400, "A valid company ID is required.");
    }

    if (typeof jobId !== "string") {
        throw new AppError(400, "A valid job ID is required.");
    }

    const job = await publishJob({
        companyId,
        jobId,
        actorUserId: getAuthenticatedUserId(request),
    });

    response.status(200).json({
        success: true,
        message: "Job published successfully.",
        job,
    });
}

export async function renewJobController(
    request: Request,
    response: Response,
): Promise<void> {
    const companyId = request.params.companyId;
    const jobId = request.params.jobId;

    if (typeof companyId !== "string") {
        throw new AppError(
            400,
            "A valid company ID is required.",
        );
    }

    if (typeof jobId !== "string") {
        throw new AppError(
            400,
            "A valid job ID is required.",
        );
    }

    const job = await renewJob({
        companyId,
        jobId,
        actorUserId:
            getAuthenticatedUserId(request),
    });

    response.status(200).json({
        success: true,
        message: "Job renewed successfully.",
        job,
    });
}

export async function unpublishJobController(request: Request, response: Response): Promise<void> {
    const companyId = request.params.companyId;
    const jobId = request.params.jobId;

    if (typeof companyId !== "string") {
        throw new AppError(400, "A valid company ID is required.");
    }

    if (typeof jobId !== "string") {
        throw new AppError(400, "A valid job ID is required.");
    }

    const job = await unpublishJob({
        companyId,
        jobId,
        actorUserId: getAuthenticatedUserId(request),
    });

    response.status(200).json({
        success: true,
        message: "Job paused successfully.",
        job,
    });
}

export async function archiveJobController(request: Request, response: Response): Promise<void> {
    const companyId = request.params.companyId;
    const jobId = request.params.jobId;

    if (typeof companyId !== "string") {
        throw new AppError(400, "A valid company ID is required.");
    }

    if (typeof jobId !== "string") {
        throw new AppError(400, "A valid job ID is required.");
    }

    const job = await archiveJob({
        companyId,
        jobId,
        actorUserId: getAuthenticatedUserId(request),
    });

    response.status(200).json({
        success: true,
        message: "Job archived successfully.",
        job,
    });
}

export async function restoreJobController(request: Request, response: Response): Promise<void> {
    const companyId = request.params.companyId;
    const jobId = request.params.jobId;

    if (typeof companyId !== "string") {
        throw new AppError(400, "A valid company ID is required.");
    }

    if (typeof jobId !== "string") {
        throw new AppError(400, "A valid job ID is required.");
    }

    const job = await restoreJob({
        companyId,
        jobId,
        actorUserId: getAuthenticatedUserId(request),
    });

    response.status(200).json({
        success: true,
        message: "Job restored successfully.",
        job,
    });
}
