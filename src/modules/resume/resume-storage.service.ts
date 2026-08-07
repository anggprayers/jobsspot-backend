import path from "node:path";
import { randomUUID } from "node:crypto";

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { R2_BUCKET_NAME, r2Client } from "../../config/r2.js";
import { AppError } from "../../errors/AppError.js";

const ALLOWED_RESUME_EXTENSIONS = new Set([".pdf", ".doc", ".docx"]);

const DEFAULT_DOWNLOAD_URL_EXPIRY_SECONDS = 5 * 60;

type UploadResumeObjectInput = {
    fileKey: string;
    fileBuffer: Buffer;
    mimeType: string;
};

export function createResumeFileKey({ userId, originalName }: { userId: string; originalName: string }): string {
    const extension = path.extname(originalName).toLowerCase();

    if (!ALLOWED_RESUME_EXTENSIONS.has(extension)) {
        throw new AppError(400, "Only PDF, DOC, and DOCX resume files are allowed.");
    }

    return `resumes/${userId}/${randomUUID()}${extension}`;
}

export async function uploadResumeObject({ fileKey, fileBuffer, mimeType }: UploadResumeObjectInput): Promise<void> {
    try {
        await r2Client.send(
            new PutObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: fileKey,
                Body: fileBuffer,
                ContentType: mimeType,
                ContentLength: fileBuffer.byteLength,
            }),
        );
    } catch (error) {
        console.error("Unable to upload resume object to R2.", error);

        throw new AppError(502, "Unable to store the resume file. Please try again.");
    }
}

export async function deleteResumeObject(fileKey: string): Promise<void> {
    try {
        await r2Client.send(
            new DeleteObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: fileKey,
            }),
        );
    } catch (error) {
        console.error("Unable to delete resume object from R2.", error);

        throw new AppError(502, "Unable to remove the stored resume file. Please try again.");
    }
}


export async function getResumeObjectBuffer(fileKey: string): Promise<Buffer> {
    try {
        const response = await r2Client.send(
            new GetObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: fileKey,
            }),
        );

        if (!response.Body) {
            throw new Error("Resume object body is empty.");
        }

        const bytes = await response.Body.transformToByteArray();
        return Buffer.from(bytes);
    } catch (error) {
        console.error("Unable to read resume object from R2.", error);
        throw new AppError(502, "Unable to read the stored resume for profile import.");
    }
}

export async function createResumeDownloadUrl({
    fileKey,
    expiresInSeconds = DEFAULT_DOWNLOAD_URL_EXPIRY_SECONDS,
}: {
    fileKey: string;
    expiresInSeconds?: number;
}): Promise<string> {
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 60 || expiresInSeconds > 15 * 60) {
        throw new AppError(500, "Resume download URL expiry must be between 60 and 900 seconds.");
    }

    try {
        return await getSignedUrl(
            r2Client,
            new GetObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: fileKey,
            }),
            {
                expiresIn: expiresInSeconds,
            },
        );
    } catch (error) {
        console.error("Unable to create a signed resume URL.", error);

        throw new AppError(502, "Unable to create a secure resume download link.");
    }
}
