import type { Request, Response } from "express";
import { z } from "zod";

import { AppError } from "../../errors/AppError.js";

import {
    deleteUserResume,
    getUserResumeDownload,
    listUserResumes,
    renameUserResume,
    setDefaultUserResume,
    uploadUserResume,
} from "./resume.service.js";

import type { RenameResumeBody, UploadResumeBody } from "./resume.validation.js";

const resumeIdSchema = z.uuid();

function getAuthenticatedUserId(request: Request): string {
    if (!request.user) {
        throw new AppError(401, "Authentication is required.");
    }

    return request.user.id;
}

function getResumeId(request: Request): string {
    const result = resumeIdSchema.safeParse(request.params.resumeId);

    if (!result.success) {
        throw new AppError(400, "A valid resume ID is required.");
    }

    return result.data;
}

export async function getResumes(request: Request, response: Response): Promise<void> {
    const userId = getAuthenticatedUserId(request);

    const resumes = await listUserResumes(userId);

    response.status(200).json({
        success: true,
        resumes,
    });
}

export async function uploadResumeController(request: Request, response: Response): Promise<void> {
    const userId = getAuthenticatedUserId(request);

    if (!request.file) {
        throw new AppError(400, 'A resume file is required in the "resume" field.');
    }

    const body = request.body as UploadResumeBody;

    const resume = await uploadUserResume({
        userId,
        file: request.file,
        ...(body.name !== undefined && {
            name: body.name,
        }),
        ...(body.isDefault !== undefined && {
            isDefault: body.isDefault,
        }),
    });

    response.status(201).json({
        success: true,
        message: "Resume uploaded successfully.",
        resume,
    });
}

export async function renameResume(request: Request, response: Response): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    const resumeId = getResumeId(request);
    const body = request.body as RenameResumeBody;

    const resume = await renameUserResume({
        userId,
        resumeId,
        name: body.name,
    });

    response.status(200).json({
        success: true,
        message: "Resume renamed successfully.",
        resume,
    });
}

export async function makeResumeDefault(request: Request, response: Response): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    const resumeId = getResumeId(request);

    const resume = await setDefaultUserResume({
        userId,
        resumeId,
    });

    response.status(200).json({
        success: true,
        message: "Default resume updated successfully.",
        resume,
    });
}

export async function getResumeDownload(request: Request, response: Response): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    const resumeId = getResumeId(request);

    const download = await getUserResumeDownload({
        userId,
        resumeId,
    });

    response.status(200).json({
        success: true,
        ...download,
    });
}

export async function removeResume(request: Request, response: Response): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    const resumeId = getResumeId(request);

    const result = await deleteUserResume({
        userId,
        resumeId,
    });

    response.status(200).json({
        success: true,
        message: "Resume deleted successfully.",
        ...result,
    });
}
