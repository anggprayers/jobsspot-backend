import type { Request, Response } from "express";

import {
    getSharedApplication,
    getSharedCoverLetterDownload,
    getSharedResumeDownload,
} from "./application-share.service.js";

export async function getSharedApplicationController(request: Request, response: Response): Promise<void> {
    const result = await getSharedApplication(request.params.token as string);
    response.status(200).json({ success: true, message: "Secure application retrieved successfully.", ...result });
}

export async function getSharedResumeDownloadController(request: Request, response: Response): Promise<void> {
    const result = await getSharedResumeDownload(request.params.token as string);
    response.status(200).json({ success: true, message: "Secure resume download link created.", ...result });
}

export async function getSharedCoverLetterDownloadController(request: Request, response: Response): Promise<void> {
    const result = await getSharedCoverLetterDownload(request.params.token as string);
    response.status(200).json({ success: true, message: "Secure cover letter download link created.", ...result });
}
