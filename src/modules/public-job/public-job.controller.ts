import type { Request, Response } from "express";

import { AppError } from "../../errors/AppError.js";

import { getPublicJobBySlug, getPublicJobs } from "./public-job.service.js";

import type { GetPublicJobsQuery } from "./public-job.validation.js";

export async function getPublicJobsController(request: Request, response: Response): Promise<void> {
    const query = response.locals.validatedQuery as GetPublicJobsQuery;

    const result = await getPublicJobs(query);

    response.status(200).json({
        success: true,
        message: "Published jobs retrieved successfully.",
        jobs: result.jobs,
        pagination: result.pagination,
    });
}

export async function getPublicJobBySlugController(request: Request, response: Response): Promise<void> {
    const slug = request.params.slug;

    if (typeof slug !== "string" || slug.trim().length === 0) {
        throw new AppError(400, "A valid job slug is required.");
    }

    const job = await getPublicJobBySlug(slug);

    response.status(200).json({
        success: true,
        message: "Published job retrieved successfully.",
        job,
    });
}
