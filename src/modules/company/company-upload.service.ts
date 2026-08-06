import type { UploadApiResponse } from "cloudinary";

import { CompanyMemberRole } from "../../generated/prisma/client.js";

import cloudinary from "../../config/cloudinary.js";
import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";

import { AuditAction, AuditEntityType } from "../audit-log/audit-log.constants.js";
import { createCompanyAuditLog } from "../audit-log/audit-log.service.js";

export type CompanyImageType = "logo" | "banner";

type CompanyPermissionParameters = {
    companyId: string;
    userId: string;
};

type UploadCompanyImageParameters = CompanyPermissionParameters & {
    imageType: CompanyImageType;
    fileBuffer: Buffer;
};

type DeleteCompanyImageParameters = CompanyPermissionParameters & {
    imageType: CompanyImageType;
};

function getCompanyImageFolder(companyId: string, imageType: CompanyImageType) {
    return `jobsspot/companies/${companyId}/${imageType}`;
}

async function requireBrandingPermission({ companyId, userId }: CompanyPermissionParameters) {
    const companyStatus = await prisma.company.findFirst({
        where: {
            id: companyId,
            deletedAt: null,
        },
        select: {
            id: true,
            suspendedAt: true,
        },
    });

    if (!companyStatus) {
        throw new AppError(404, "Company not found.");
    }

    if (companyStatus.suspendedAt) {
        throw new AppError(
            403,
            "This company workspace has been suspended. Contact JobsSpot support for assistance.",
        );
    }

    const membership = await prisma.companyMembership.findFirst({
        where: {
            companyId,
            userId,
            deletedAt: null,

            role: {
                in: [CompanyMemberRole.OWNER, CompanyMemberRole.ADMIN],
            },
        },

        select: {
            id: true,
            role: true,

            company: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    logoUrl: true,
                    logoPublicId: true,
                    bannerUrl: true,
                    bannerPublicId: true,
                },
            },
        },
    });

    if (!membership) {
        throw new AppError(403, "Only company owners and administrators can manage company branding.");
    }

    return membership.company;
}

function uploadBufferToCloudinary({
    companyId,
    imageType,
    fileBuffer,
}: {
    companyId: string;
    imageType: CompanyImageType;
    fileBuffer: Buffer;
}) {
    return new Promise<UploadApiResponse>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                resource_type: "image",

                folder: getCompanyImageFolder(companyId, imageType),

                overwrite: false,
                unique_filename: true,
                use_filename: false,

                transformation:
                    imageType === "logo"
                        ? [
                              {
                                  width: 800,
                                  height: 800,
                                  crop: "limit",
                              },
                              {
                                  quality: "auto",
                                  fetch_format: "auto",
                              },
                          ]
                        : [
                              {
                                  width: 2400,
                                  height: 1200,
                                  crop: "limit",
                              },
                              {
                                  quality: "auto",
                                  fetch_format: "auto",
                              },
                          ],
            },

            (error, result) => {
                if (error) {
                    reject(error);
                    return;
                }

                if (!result) {
                    reject(new Error("Cloudinary did not return an upload result."));

                    return;
                }

                resolve(result);
            },
        );

        uploadStream.end(fileBuffer);
    });
}

async function deleteCloudinaryImage(publicId: string | null) {
    if (!publicId) {
        return;
    }

    const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: "image",
        invalidate: true,
    });

    if (result.result !== "ok" && result.result !== "not found") {
        throw new Error(`Cloudinary deletion failed: ${result.result}`);
    }
}

export async function uploadCompanyImage({ companyId, userId, imageType, fileBuffer }: UploadCompanyImageParameters) {
    if (!fileBuffer.length) {
        throw new AppError(400, "The uploaded image is empty.");
    }

    const company = await requireBrandingPermission({
        companyId,
        userId,
    });

    let uploadedImage: UploadApiResponse;

    try {
        uploadedImage = await uploadBufferToCloudinary({
            companyId,
            imageType,
            fileBuffer,
        });
    } catch (error) {
        console.error("Cloudinary upload failed:", error);

        throw new AppError(502, "Unable to upload the company image.");
    }

    const previousPublicId = imageType === "logo" ? company.logoPublicId : company.bannerPublicId;

    const previousImageUrl = imageType === "logo" ? company.logoUrl : company.bannerUrl;

    try {
        const updatedCompany = await prisma.$transaction(async (transaction) => {
            const updated = await transaction.company.update({
                where: {
                    id: companyId,
                },

                data:
                    imageType === "logo"
                        ? {
                              logoUrl: uploadedImage.secure_url,

                              logoPublicId: uploadedImage.public_id,
                          }
                        : {
                              bannerUrl: uploadedImage.secure_url,

                              bannerPublicId: uploadedImage.public_id,
                          },

                select: {
                    id: true,
                    name: true,
                    slug: true,
                    logoUrl: true,
                    bannerUrl: true,
                    updatedAt: true,
                },
            });

            await createCompanyAuditLog({
                transaction,
                companyId,
                actorUserId: userId,

                action: imageType === "logo" ? AuditAction.COMPANY_LOGO_UPDATED : AuditAction.COMPANY_BANNER_UPDATED,

                entityType: AuditEntityType.COMPANY,

                entityId: updated.id,

                metadata: {
                    companyId: updated.id,

                    companyName: updated.name,

                    imageType,

                    replacedExistingImage: Boolean(previousPublicId || previousImageUrl),
                },
            });

            return updated;
        });

        /*
         * Delete the previous Cloudinary image after the
         * database and audit transaction succeeds.
         */
        if (previousPublicId && previousPublicId !== uploadedImage.public_id) {
            try {
                await deleteCloudinaryImage(previousPublicId);
            } catch (error) {
                console.error(`Failed to delete previous company ${imageType}:`, error);
            }
        }

        return updatedCompany;
    } catch (error) {
        /*
         * The database operation failed, so remove the
         * newly uploaded image to avoid an unused asset.
         */
        try {
            await deleteCloudinaryImage(uploadedImage.public_id);
        } catch (cleanupError) {
            console.error("Failed to clean up the newly uploaded Cloudinary image:", cleanupError);
        }

        throw error;
    }
}

export async function deleteCompanyImage({ companyId, userId, imageType }: DeleteCompanyImageParameters) {
    const company = await requireBrandingPermission({
        companyId,
        userId,
    });

    const currentPublicId = imageType === "logo" ? company.logoPublicId : company.bannerPublicId;

    const currentImageUrl = imageType === "logo" ? company.logoUrl : company.bannerUrl;

    if (!currentPublicId && !currentImageUrl) {
        throw new AppError(400, `The company ${imageType} is already removed.`);
    }

    /*
     * Remove the database reference and record the audit
     * event together. Cloudinary cleanup runs afterward
     * because an external API cannot participate in the
     * PostgreSQL transaction.
     */
    const updatedCompany = await prisma.$transaction(async (transaction) => {
        const updated = await transaction.company.update({
            where: {
                id: companyId,
            },

            data:
                imageType === "logo"
                    ? {
                          logoUrl: null,
                          logoPublicId: null,
                      }
                    : {
                          bannerUrl: null,
                          bannerPublicId: null,
                      },

            select: {
                id: true,
                name: true,
                slug: true,
                logoUrl: true,
                bannerUrl: true,
                updatedAt: true,
            },
        });

        await createCompanyAuditLog({
            transaction,
            companyId,
            actorUserId: userId,

            action: imageType === "logo" ? AuditAction.COMPANY_LOGO_REMOVED : AuditAction.COMPANY_BANNER_REMOVED,

            entityType: AuditEntityType.COMPANY,

            entityId: updated.id,

            metadata: {
                companyId: updated.id,

                companyName: updated.name,

                imageType,
            },
        });

        return updated;
    });

    if (currentPublicId) {
        try {
            await deleteCloudinaryImage(currentPublicId);
        } catch (error) {
            /*
             * The company no longer references the image,
             * so a cleanup failure should not reverse the
             * successful user-facing removal.
             */
            console.error(`Failed to clean up removed company ${imageType}:`, error);
        }
    }

    return updatedCompany;
}
