import type { Request, Response } from "express";
import { z } from "zod";

import { AppError } from "../../errors/AppError.js";

import {
    createUserSavedSearch,
    deleteUserSavedSearch,
    listUserSavedSearches,
    updateUserSavedSearch,
} from "./saved-search.service.js";

import {
    savedSearchesQuerySchema,
    type CreateSavedSearchBody,
    type UpdateSavedSearchBody,
} from "./saved-search.validation.js";

const savedSearchIdSchema = z.uuid();

function getAuthenticatedUserId(
    request: Request,
): string {
    if (!request.user) {
        throw new AppError(
            401,
            "Authentication is required.",
        );
    }

    return request.user.id;
}

function getSavedSearchId(
    request: Request,
): string {
    const result = savedSearchIdSchema.safeParse(
        request.params.savedSearchId,
    );

    if (!result.success) {
        throw new AppError(
            400,
            "A valid saved search ID is required.",
        );
    }

    return result.data;
}

function parseSavedSearchesQuery(request: Request) {
    const result = savedSearchesQuerySchema.safeParse(
        request.query,
    );

    if (!result.success) {
        throw new AppError(
            400,
            result.error.issues[0]?.message ??
                "Invalid saved searches query.",
        );
    }

    return result.data;
}

export async function getSavedSearchesController(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    const query = parseSavedSearchesQuery(request);

    const result = await listUserSavedSearches({
        userId,
        ...query,
    });

    response.status(200).json({
        success: true,
        message:
            "Saved searches retrieved successfully.",
        ...result,
    });
}

export async function createSavedSearchController(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    const body = request.body as CreateSavedSearchBody;

    const savedSearch =
        await createUserSavedSearch({
            userId,
            data: body,
        });

    response.status(201).json({
        success: true,
        message: "Search saved successfully.",
        savedSearch,
    });
}

export async function updateSavedSearchController(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    const savedSearchId = getSavedSearchId(request);
    const body = request.body as UpdateSavedSearchBody;

    const savedSearch =
        await updateUserSavedSearch({
            userId,
            savedSearchId,
            data: body,
        });

    response.status(200).json({
        success: true,
        message:
            "Saved search updated successfully.",
        savedSearch,
    });
}

export async function removeSavedSearchController(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    const savedSearchId = getSavedSearchId(request);

    const result = await deleteUserSavedSearch({
        userId,
        savedSearchId,
    });

    response.status(200).json({
        success: true,
        message:
            "Saved search deleted successfully.",
        ...result,
    });
}
