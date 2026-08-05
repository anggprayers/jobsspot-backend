import path from "node:path";

import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";

import {
    createResumeDownloadUrl,
    createResumeFileKey,
    deleteResumeObject,
    uploadResumeObject,
} from "./resume-storage.service.js";

const MAX_RESUMES_PER_USER = 10;
const MAX_RESUME_NAME_LENGTH = 100;

const resumeSelect = {
    id: true,
    name: true,
    mimeType: true,
    fileSize: true,
    isDefault: true,
    createdAt: true,
    updatedAt: true,
} as const;

type UploadUserResumeInput = {
    userId: string;
    file: Express.Multer.File;
    name?: string;
    isDefault?: boolean;
};

type RenameUserResumeInput = {
    userId: string;
    resumeId: string;
    name: string;
};

function normalizeResumeName({
    requestedName,
    originalName,
}: {
    requestedName: string | undefined;
    originalName: string;
}): string {
    const fallbackName = path.basename(originalName, path.extname(originalName));

    const normalizedName = (requestedName ?? fallbackName).trim().replace(/\s+/g, " ");

    if (!normalizedName) {
        throw new AppError(400, "Resume name is required.");
    }

    if (normalizedName.length > MAX_RESUME_NAME_LENGTH) {
        throw new AppError(400, `Resume name must not exceed ${MAX_RESUME_NAME_LENGTH} characters.`);
    }

    return normalizedName;
}

function startsWithBytes(buffer: Buffer, signature: number[]): boolean {
    if (buffer.length < signature.length) {
        return false;
    }

    return signature.every((byte, index) => buffer[index] === byte);
}

function hasPdfSignature(buffer: Buffer): boolean {
    const pdfHeader = Buffer.from("%PDF-");

    // PDF readers allow the header to appear near the beginning of the file.
    // Limiting the search to the first 1,024 bytes avoids accepting arbitrary
    // files that merely contain "%PDF-" somewhere later in their contents.
    return buffer.subarray(0, 1024).includes(pdfHeader);
}

function getCanonicalResumeMimeType(originalName: string): string {
    const extension = path.extname(originalName).toLowerCase();

    switch (extension) {
        case ".pdf":
            return "application/pdf";
        case ".doc":
            return "application/msword";
        case ".docx":
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        default:
            throw new AppError(400, "Only PDF, DOC, and DOCX resume files are allowed.");
    }
}

function validateResumeFileContents(file: Express.Multer.File): void {
    const extension = path.extname(file.originalname).toLowerCase();

    if (file.buffer.length === 0) {
        throw new AppError(400, "The uploaded resume file is empty.");
    }

    if (extension === ".pdf") {
        const hasAllowedMimeType = file.mimetype === "application/pdf" || file.mimetype === "application/octet-stream";

        if (!hasAllowedMimeType || !hasPdfSignature(file.buffer)) {
            throw new AppError(400, "The uploaded file is not a valid PDF document.");
        }

        return;
    }

    if (extension === ".doc") {
        const hasAllowedMimeType =
            file.mimetype === "application/msword" || file.mimetype === "application/octet-stream";

        const hasCompoundDocumentSignature = startsWithBytes(
            file.buffer,
            [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1],
        );

        if (!hasAllowedMimeType || !hasCompoundDocumentSignature) {
            throw new AppError(400, "The uploaded file is not a valid DOC document.");
        }

        return;
    }

    if (extension === ".docx") {
        const hasAllowedMimeType =
            file.mimetype === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
            file.mimetype === "application/octet-stream";

        const hasZipSignature =
            startsWithBytes(file.buffer, [0x50, 0x4b, 0x03, 0x04]) ||
            startsWithBytes(file.buffer, [0x50, 0x4b, 0x05, 0x06]) ||
            startsWithBytes(file.buffer, [0x50, 0x4b, 0x07, 0x08]);

        const containsWordDocumentEntry =
            file.buffer.includes(Buffer.from("word/document.xml")) || file.buffer.includes(Buffer.from("word/"));

        if (!hasAllowedMimeType || !hasZipSignature || !containsWordDocumentEntry) {
            throw new AppError(400, "The uploaded file is not a valid DOCX document.");
        }

        return;
    }

    throw new AppError(400, "Only PDF, DOC, and DOCX resume files are allowed.");
}

async function findOwnedActiveResume(userId: string, resumeId: string) {
    const resume = await prisma.resume.findFirst({
        where: {
            id: resumeId,
            userId,
            deletedAt: null,
        },
        select: {
            ...resumeSelect,
            fileKey: true,
        },
    });

    if (!resume) {
        throw new AppError(404, "Resume not found.");
    }

    return resume;
}

export async function listUserResumes(userId: string) {
    return prisma.resume.findMany({
        where: {
            userId,
            deletedAt: null,
        },
        select: resumeSelect,
        orderBy: [
            {
                isDefault: "desc",
            },
            {
                createdAt: "desc",
            },
        ],
    });
}

export async function uploadUserResume({ userId, file, name, isDefault = false }: UploadUserResumeInput) {
    validateResumeFileContents(file);

    const activeResumeCount = await prisma.resume.count({
        where: {
            userId,
            deletedAt: null,
        },
    });

    if (activeResumeCount >= MAX_RESUMES_PER_USER) {
        throw new AppError(400, `You can store up to ${MAX_RESUMES_PER_USER} resumes.`);
    }

    const normalizedName = normalizeResumeName({
        requestedName: name,
        originalName: file.originalname,
    });

    const shouldBeDefault = isDefault || activeResumeCount === 0;

    const canonicalMimeType = getCanonicalResumeMimeType(file.originalname);

    const fileKey = createResumeFileKey({
        userId,
        originalName: file.originalname,
    });

    await uploadResumeObject({
        fileKey,
        fileBuffer: file.buffer,
        mimeType: canonicalMimeType,
    });

    try {
        return await prisma.$transaction(async (transaction) => {
            if (shouldBeDefault) {
                await transaction.resume.updateMany({
                    where: {
                        userId,
                        deletedAt: null,
                        isDefault: true,
                    },
                    data: {
                        isDefault: false,
                    },
                });
            }

            return transaction.resume.create({
                data: {
                    userId,
                    name: normalizedName,
                    fileKey,
                    fileUrl: null,
                    mimeType: canonicalMimeType,
                    fileSize: file.size,
                    isDefault: shouldBeDefault,
                },
                select: resumeSelect,
            });
        });
    } catch (error) {
        try {
            await deleteResumeObject(fileKey);
        } catch (cleanupError) {
            console.error("Unable to clean up an uploaded resume after a database failure.", cleanupError);
        }

        throw error;
    }
}

export async function renameUserResume({ userId, resumeId, name }: RenameUserResumeInput) {
    await findOwnedActiveResume(userId, resumeId);

    const normalizedName = normalizeResumeName({
        requestedName: name,
        originalName: name,
    });

    return prisma.resume.update({
        where: {
            id: resumeId,
        },
        data: {
            name: normalizedName,
        },
        select: resumeSelect,
    });
}

export async function setDefaultUserResume({ userId, resumeId }: { userId: string; resumeId: string }) {
    const resume = await findOwnedActiveResume(userId, resumeId);

    if (resume.isDefault) {
        return {
            id: resume.id,
            name: resume.name,
            mimeType: resume.mimeType,
            fileSize: resume.fileSize,
            isDefault: resume.isDefault,
            createdAt: resume.createdAt,
            updatedAt: resume.updatedAt,
        };
    }

    return prisma.$transaction(async (transaction) => {
        await transaction.resume.updateMany({
            where: {
                userId,
                deletedAt: null,
                isDefault: true,
            },
            data: {
                isDefault: false,
            },
        });

        return transaction.resume.update({
            where: {
                id: resumeId,
            },
            data: {
                isDefault: true,
            },
            select: resumeSelect,
        });
    });
}

export async function getUserResumeDownload({ userId, resumeId }: { userId: string; resumeId: string }) {
    const resume = await findOwnedActiveResume(userId, resumeId);

    const downloadUrl = await createResumeDownloadUrl({
        fileKey: resume.fileKey,
    });

    return {
        resume: {
            id: resume.id,
            name: resume.name,
            mimeType: resume.mimeType,
        },
        downloadUrl,
        expiresInSeconds: 5 * 60,
    };
}

export async function deleteUserResume({ userId, resumeId }: { userId: string; resumeId: string }) {
    const resume = await prisma.resume.findFirst({
        where: {
            id: resumeId,
            userId,
            deletedAt: null,
        },
        select: {
            id: true,
            fileKey: true,
            isDefault: true,
            _count: {
                select: {
                    applications: true,
                },
            },
        },
    });

    if (!resume) {
        throw new AppError(404, "Resume not found.");
    }

    await prisma.$transaction(async (transaction) => {
        await transaction.resume.update({
            where: {
                id: resume.id,
            },
            data: {
                isDefault: false,
                deletedAt: new Date(),
            },
        });

        if (resume.isDefault) {
            const nextDefaultResume = await transaction.resume.findFirst({
                where: {
                    userId,
                    deletedAt: null,
                    id: {
                        not: resume.id,
                    },
                },
                select: {
                    id: true,
                },
                orderBy: {
                    createdAt: "desc",
                },
            });

            if (nextDefaultResume) {
                await transaction.resume.update({
                    where: {
                        id: nextDefaultResume.id,
                    },
                    data: {
                        isDefault: true,
                    },
                });
            }
        }
    });

    if (resume._count.applications === 0) {
        try {
            await deleteResumeObject(resume.fileKey);
        } catch (error) {
            console.error(
                "Resume was removed from the account, but its private R2 object requires later cleanup.",
                error,
            );
        }
    }

    return {
        id: resume.id,
        retainedForApplications: resume._count.applications > 0,
    };
}
