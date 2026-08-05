import type { Request, Response } from "express";
import { z } from "zod";

import { AppError } from "../../errors/AppError.js";

import {
    createUserEducation,
    deleteUserEducation,
    listUserEducation,
    updateUserEducation,
} from "./job-seeker-education.service.js";

import type {
    CreateEducationBody,
    UpdateEducationBody,
} from "./job-seeker-education.validation.js";

const educationIdSchema = z.uuid();

function getAuthenticatedUserId(request: Request): string {
    if (!request.user) {
        throw new AppError(401, "Authentication is required.");
    }

    return request.user.id;
}

function getEducationId(request: Request): string {
    const result = educationIdSchema.safeParse(
        request.params.educationId,
    );

    if (!result.success) {
        throw new AppError(400, "A valid education ID is required.");
    }

    return result.data;
}

export async function getEducation(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);

    const education = await listUserEducation(userId);

    response.status(200).json({
        success: true,
        education,
    });
}

export async function createEducation(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    const body = request.body as CreateEducationBody;

    const education = await createUserEducation({
        userId,
        data: body,
    });

    response.status(201).json({
        success: true,
        message: "Education added successfully.",
        education,
    });
}

export async function updateEducation(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    const educationId = getEducationId(request);
    const body = request.body as UpdateEducationBody;

    const education = await updateUserEducation({
        userId,
        educationId,
        data: body,
    });

    response.status(200).json({
        success: true,
        message: "Education updated successfully.",
        education,
    });
}

export async function removeEducation(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    const educationId = getEducationId(request);

    const result = await deleteUserEducation({
        userId,
        educationId,
    });

    response.status(200).json({
        success: true,
        message: "Education removed successfully.",
        ...result,
    });
}
