import type { Request, Response } from "express";

import { AppError } from "../../errors/AppError.js";

import {
    getCompanyApplicationById,
    getCompanyApplications,
    updateCompanyApplicationStatus,
} from "./employer-application.service.js";

import {
    employerApplicationsQuerySchema,
    type UpdateEmployerApplicationStatusInput,
} from "./employer-application.validation.js";

export async function getCompanyApplicationsController(request: Request, response: Response): Promise<void> {
    const companyId = request.params.companyId;

    if (typeof companyId !== "string") {
        throw new AppError(400, "A valid company ID is required.");
    }

    const query = employerApplicationsQuerySchema.parse(request.query);

    const result = await getCompanyApplications({
        companyId,

        ...(query.search !== undefined && {
            search: query.search,
        }),

        ...(query.jobId !== undefined && {
            jobId: query.jobId,
        }),

        ...(query.status !== undefined && {
            status: query.status,
        }),

        page: query.page,
        limit: query.limit,
    });

    response.status(200).json({
        success: true,
        message: "Company applications retrieved successfully.",
        ...result,
    });
}

export async function getCompanyApplicationByIdController(request: Request, response: Response): Promise<void> {
    const companyId = request.params.companyId;
    const applicationId = request.params.applicationId;

    if (typeof companyId !== "string") {
        throw new AppError(400, "A valid company ID is required.");
    }

    if (typeof applicationId !== "string") {
        throw new AppError(400, "A valid application ID is required.");
    }

    const application = await getCompanyApplicationById({
        companyId,
        applicationId,
    });

    response.status(200).json({
        success: true,
        message: "Application retrieved successfully.",
        application,
    });
}

export async function updateCompanyApplicationStatusController(request: Request, response: Response): Promise<void> {
    const companyId = request.params.companyId;
    const applicationId = request.params.applicationId;

    if (typeof companyId !== "string") {
        throw new AppError(400, "A valid company ID is required.");
    }

    if (typeof applicationId !== "string") {
        throw new AppError(400, "A valid application ID is required.");
    }

    if (!request.user) {
        throw new AppError(401, "Authentication is required.");
    }

    const { status } = request.body as UpdateEmployerApplicationStatusInput;

    const application = await updateCompanyApplicationStatus({
        companyId,
        applicationId,
        actorUserId: request.user.id,
        status,
    });

    response.status(200).json({
        success: true,
        message: "Application status updated successfully.",
        application,
    });
}
