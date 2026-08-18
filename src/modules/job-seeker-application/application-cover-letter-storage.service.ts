import path from "node:path";
import { randomUUID } from "node:crypto";

import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import { R2_BUCKET_NAME, r2Client } from "../../config/r2.js";
import { AppError } from "../../errors/AppError.js";

const ALLOWED_EXTENSIONS = new Set([".pdf", ".doc", ".docx"]);
const DEFAULT_DOWNLOAD_URL_EXPIRY_SECONDS = 5 * 60;

function startsWithBytes(buffer: Buffer, bytes: number[]): boolean {
    if (buffer.length < bytes.length) {
        return false;
    }

    return bytes.every((byte, index) => buffer[index] === byte);
}

function hasPdfSignature(buffer: Buffer): boolean {
    return buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"));
}

function getCanonicalMimeType(originalName: string): string {
    const extension = path.extname(originalName).toLowerCase();

    switch (extension) {
        case ".pdf":
            return "application/pdf";
        case ".doc":
            return "application/msword";
        case ".docx":
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        default:
            throw new AppError(400, "Only PDF, DOC, and DOCX cover letter files are allowed.");
    }
}

export function validateCoverLetterFile(file: Express.Multer.File): string {
    if (file.buffer.length === 0) {
        throw new AppError(400, "The uploaded cover letter file is empty.");
    }

    const extension = path.extname(file.originalname).toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(extension)) {
        throw new AppError(400, "Only PDF, DOC, and DOCX cover letter files are allowed.");
    }

    if (extension === ".pdf") {
        if (!hasPdfSignature(file.buffer)) {
            throw new AppError(400, "The uploaded file is not a valid PDF document.");
        }
    } else if (extension === ".doc") {
        if (!startsWithBytes(file.buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) {
            throw new AppError(400, "The uploaded file is not a valid DOC document.");
        }
    } else {
        const hasZipSignature =
            startsWithBytes(file.buffer, [0x50, 0x4b, 0x03, 0x04]) ||
            startsWithBytes(file.buffer, [0x50, 0x4b, 0x05, 0x06]) ||
            startsWithBytes(file.buffer, [0x50, 0x4b, 0x07, 0x08]);
        const containsWordDocumentEntry =
            file.buffer.includes(Buffer.from("word/document.xml")) ||
            file.buffer.includes(Buffer.from("word/"));

        if (!hasZipSignature || !containsWordDocumentEntry) {
            throw new AppError(400, "The uploaded file is not a valid DOCX document.");
        }
    }

    return getCanonicalMimeType(file.originalname);
}

export function createCoverLetterFileKey({
    userId,
    originalName,
}: {
    userId: string;
    originalName: string;
}): string {
    const extension = path.extname(originalName).toLowerCase();

    if (!ALLOWED_EXTENSIONS.has(extension)) {
        throw new AppError(400, "Only PDF, DOC, and DOCX cover letter files are allowed.");
    }

    return `cover-letters/${userId}/${randomUUID()}${extension}`;
}

export async function uploadCoverLetterObject({
    fileKey,
    fileBuffer,
    mimeType,
}: {
    fileKey: string;
    fileBuffer: Buffer;
    mimeType: string;
}): Promise<void> {
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
        console.error("Unable to upload cover letter object to R2.", error);
        throw new AppError(502, "Unable to store the cover letter file. Please try again.");
    }
}

export async function deleteCoverLetterObject(fileKey: string): Promise<void> {
    try {
        await r2Client.send(
            new DeleteObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: fileKey,
            }),
        );
    } catch (error) {
        console.error("Unable to delete cover letter object from R2.", error);
    }
}

export async function createCoverLetterDownloadUrl({
    fileKey,
    expiresInSeconds = DEFAULT_DOWNLOAD_URL_EXPIRY_SECONDS,
}: {
    fileKey: string;
    expiresInSeconds?: number;
}): Promise<string> {
    try {
        return await getSignedUrl(
            r2Client,
            new GetObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: fileKey,
            }),
            { expiresIn: expiresInSeconds },
        );
    } catch (error) {
        console.error("Unable to create a signed cover letter URL.", error);
        throw new AppError(502, "Unable to create a secure cover letter download link.");
    }
}
