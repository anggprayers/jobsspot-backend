import type { Request, Response } from "express";

import { AppError } from "../../errors/AppError.js";

import { getCompanyActivity } from "./audit-log.service.js";
import { companyActivityQuerySchema } from "./audit-log.validation.js";

export async function getCompanyActivityController(request: Request, response: Response): Promise<void> {
    const companyId = request.params.companyId;

    if (typeof companyId !== "string") {
        throw new AppError(400, "A valid company ID is required.");
    }

    const query = companyActivityQuerySchema.parse(request.query);

    const result = await getCompanyActivity({
        companyId,
        page: query.page,
        limit: query.limit,

        ...(query.action !== undefined && {
            action: query.action,
        }),

        ...(query.entityType !== undefined && {
            entityType: query.entityType,
        }),
    });

    response.status(200).json({
        success: true,
        message: "Company activity retrieved successfully.",
        ...result,
    });
}
