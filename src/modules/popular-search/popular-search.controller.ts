import type { Request, Response } from "express";

import { AppError } from "../../errors/AppError.js";

import {
    listPopularSearches,
    trackPopularSearch,
} from "./popular-search.service.js";

import {
    popularSearchesQuerySchema,
    type TrackPopularSearchBody,
} from "./popular-search.validation.js";

function parsePopularSearchesQuery(
    request: Request,
) {
    const result =
        popularSearchesQuerySchema.safeParse(
            request.query,
        );

    if (!result.success) {
        throw new AppError(
            400,
            result.error.issues[0]?.message ??
                "Invalid popular searches query.",
        );
    }

    return result.data;
}

export async function getPopularSearchesController(
    request: Request,
    response: Response,
): Promise<void> {
    const query =
        parsePopularSearchesQuery(request);

    const popularSearches =
        await listPopularSearches(query);

    response.status(200).json({
        success: true,
        message:
            "Popular searches retrieved successfully.",
        popularSearches,
        periodDays: query.days,
    });
}

export async function trackPopularSearchController(
    request: Request,
    response: Response,
): Promise<void> {
    const body =
        request.body as TrackPopularSearchBody;

    await trackPopularSearch(body);

    response.status(202).json({
        success: true,
        message: "Search recorded successfully.",
    });
}
