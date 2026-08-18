import { createHash } from "node:crypto";

import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { createCoverLetterDownloadUrl } from "../job-seeker-application/application-cover-letter-storage.service.js";
import { createResumeDownloadUrl } from "../resume/resume-storage.service.js";

function hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

async function getActiveShare(token: string) {
    const share = await prisma.applicationShareLink.findUnique({
        where: { tokenHash: hashToken(token) },
        select: {
            id: true,
            includeResume: true,
            includeCoverLetter: true,
            expiresAt: true,
            revokedAt: true,
            application: {
                select: {
                    id: true,
                    coverLetter: true,
                    coverLetterFileKey: true,
                    coverLetterFileName: true,
                    coverLetterFileMimeType: true,
                    coverLetterFileSize: true,
                    applicant: {
                        select: {
                            firstName: true,
                            lastName: true,
                            deletedAt: true,
                        },
                    },
                    job: {
                        select: {
                            title: true,
                            company: { select: { name: true } },
                        },
                    },
                    resume: {
                        select: {
                            name: true,
                            fileKey: true,
                            mimeType: true,
                            fileSize: true,
                        },
                    },
                },
            },
        },
    });

    if (!share || share.revokedAt || share.expiresAt <= new Date()) {
        throw new AppError(404, "This secure application link is invalid or has expired.");
    }
    if (share.application.applicant.deletedAt) {
        throw new AppError(410, "This application is no longer available.");
    }
    return share;
}

async function recordShareAccess(shareId: string): Promise<void> {
    await prisma.applicationShareLink.update({
        where: { id: shareId },
        data: {
            accessCount: { increment: 1 },
            lastAccessedAt: new Date(),
        },
    });
}

export async function getSharedApplication(token: string) {
    const share = await getActiveShare(token);
    await recordShareAccess(share.id);

    const applicantName = `${share.application.applicant.firstName} ${share.application.applicant.lastName}`.trim();
    return {
        application: {
            applicantName,
            jobTitle: share.application.job.title,
            companyName: share.application.job.company.name,
            coverLetter: share.includeCoverLetter ? share.application.coverLetter : null,
            resume: share.includeResume && share.application.resume
                ? {
                    name: share.application.resume.name,
                    mimeType: share.application.resume.mimeType,
                    fileSize: share.application.resume.fileSize,
                }
                : null,
            coverLetterFile: share.includeCoverLetter && share.application.coverLetterFileKey
                ? {
                    name: share.application.coverLetterFileName,
                    mimeType: share.application.coverLetterFileMimeType,
                    fileSize: share.application.coverLetterFileSize,
                }
                : null,
        },
        expiresAt: share.expiresAt,
    };
}

export async function getSharedResumeDownload(token: string) {
    const share = await getActiveShare(token);
    if (!share.includeResume || !share.application.resume) {
        throw new AppError(404, "Resume access is not enabled for this secure link.");
    }
    await recordShareAccess(share.id);
    return {
        downloadUrl: await createResumeDownloadUrl({ fileKey: share.application.resume.fileKey }),
        expiresInSeconds: 5 * 60,
    };
}

export async function getSharedCoverLetterDownload(token: string) {
    const share = await getActiveShare(token);
    if (!share.includeCoverLetter || !share.application.coverLetterFileKey) {
        throw new AppError(404, "Cover letter file access is not enabled for this secure link.");
    }
    await recordShareAccess(share.id);
    return {
        downloadUrl: await createCoverLetterDownloadUrl({ fileKey: share.application.coverLetterFileKey }),
        expiresInSeconds: 5 * 60,
    };
}
