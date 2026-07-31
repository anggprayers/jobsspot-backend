import type { NextFunction, Request, Response } from "express";
import type { CompanyMemberRole } from "../generated/prisma/client.js";

import { AppError } from "../errors/AppError.js";
import { prisma } from "../lib/prisma.js";

export function requireCompanyRole(allowedRoles: CompanyMemberRole[]) {
    return async function companyRoleMiddleware(
        request: Request,
        _response: Response,
        next: NextFunction,
    ): Promise<void> {
        if (!request.user) {
            throw new AppError(401, "Authentication is required.");
        }

        const companyId = request.params.companyId;

        if (!companyId || Array.isArray(companyId)) {
            throw new AppError(400, "A valid company ID is required.");
        }

        const company = await prisma.company.findFirst({
            where: {
                id: companyId,
                deletedAt: null,
            },
            select: {
                id: true,
            },
        });

        if (!company) {
            throw new AppError(404, "Company not found.");
        }

        const membership = await prisma.companyMembership.findFirst({
            where: {
                companyId,
                userId: request.user.id,
                deletedAt: null,
            },
            select: {
                id: true,
                companyId: true,
                userId: true,
                role: true,
            },
        });

        if (!membership) {
            throw new AppError(403, "You are not a member of this company.");
        }

        if (!allowedRoles.includes(membership.role)) {
            throw new AppError(403, "You do not have permission to perform this action.");
        }

        request.companyMembership = membership;

        next();
    };
}
