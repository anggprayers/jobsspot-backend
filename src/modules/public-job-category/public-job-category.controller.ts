import type { Request, Response } from "express";

import { AppError } from "../../errors/AppError.js";

import { getPublicJobCategories, getPublicJobCategoryBySlug } from "./public-job-category.service.js";

export async function getPublicJobCategoriesController(_request: Request, response: Response): Promise<void> {
    const categories = await getPublicJobCategories();

    response.status(200).json({
        success: true,
        message: "Job categories retrieved successfully.",
        categories,
    });
}

export async function getPublicJobCategoryBySlugController(request: Request, response: Response): Promise<void> {
    const slug = request.params.slug;

    if (typeof slug !== "string" || slug.trim().length === 0) {
        throw new AppError(400, "A valid job category slug is required.");
    }

    const category = await getPublicJobCategoryBySlug(slug.trim());

    response.status(200).json({
        success: true,
        message: "Job category retrieved successfully.",
        category,
    });
}
