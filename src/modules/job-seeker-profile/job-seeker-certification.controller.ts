import type { Request, Response } from "express";
import { z } from "zod";

import { AppError } from "../../errors/AppError.js";

import {
    createUserCertification,
    deleteUserCertification,
    listUserCertifications,
    updateUserCertification,
} from "./job-seeker-certification.service.js";

import type {
    CreateCertificationBody,
    UpdateCertificationBody,
} from "./job-seeker-certification.validation.js";

const certificationIdSchema = z.uuid();

function getAuthenticatedUserId(request: Request): string {
    if (!request.user) {
        throw new AppError(401, "Authentication is required.");
    }

    return request.user.id;
}

function getCertificationId(request: Request): string {
    const result = certificationIdSchema.safeParse(
        request.params.certificationId,
    );

    if (!result.success) {
        throw new AppError(
            400,
            "A valid certification ID is required.",
        );
    }

    return result.data;
}

export async function getCertifications(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);

    const certifications = await listUserCertifications(userId);

    response.status(200).json({
        success: true,
        certifications,
    });
}

export async function createCertification(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    const body = request.body as CreateCertificationBody;

    const certification = await createUserCertification({
        userId,
        data: body,
    });

    response.status(201).json({
        success: true,
        message: "Certification added successfully.",
        certification,
    });
}

export async function updateCertification(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    const certificationId = getCertificationId(request);
    const body = request.body as UpdateCertificationBody;

    const certification = await updateUserCertification({
        userId,
        certificationId,
        data: body,
    });

    response.status(200).json({
        success: true,
        message: "Certification updated successfully.",
        certification,
    });
}

export async function removeCertification(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    const certificationId = getCertificationId(request);

    const result = await deleteUserCertification({
        userId,
        certificationId,
    });

    response.status(200).json({
        success: true,
        message: "Certification removed successfully.",
        ...result,
    });
}
