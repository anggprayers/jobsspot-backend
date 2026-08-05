import type { Request, Response } from "express";

import { AppError } from "../../errors/AppError.js";

import {
    addCompanyMember,
    getCompanyMembers,
    removeCompanyMember,
    searchCompanyMemberCandidates,
    transferCompanyOwnership,
    updateCompanyMemberRole,
} from "./company-member.service.js";

import { searchCompanyMemberCandidatesSchema } from "./company-member.validation.js";

function getAuthenticatedUserId(request: Request): string {
    if (!request.user) {
        throw new AppError(401, "Authentication is required.");
    }

    return request.user.id;
}

function getCompanyId(request: Request): string {
    const companyId = request.params.companyId;

    if (typeof companyId !== "string") {
        throw new AppError(400, "A valid company ID is required.");
    }

    return companyId;
}

export async function getCompanyMembersController(request: Request, response: Response): Promise<void> {
    const companyId = getCompanyId(request);

    const members = await getCompanyMembers(companyId);

    response.status(200).json({
        success: true,
        message: "Company members retrieved successfully.",
        members,
    });
}

export async function searchCompanyMemberCandidatesController(request: Request, response: Response): Promise<void> {
    const companyId = getCompanyId(request);
    const actorUserId = getAuthenticatedUserId(request);

    const rawQuery = Array.isArray(request.query.query) ? request.query.query[0] : request.query.query;

    const validationResult = searchCompanyMemberCandidatesSchema.safeParse({
        query: rawQuery,
    });

    if (!validationResult.success) {
        throw new AppError(400, validationResult.error.issues[0]?.message ?? "A valid search query is required.");
    }

    const users = await searchCompanyMemberCandidates({
        companyId,
        actorUserId,
        query: validationResult.data.query,
    });

    response.status(200).json({
        success: true,
        message: "Eligible company members retrieved successfully.",
        users,
    });
}

export async function addCompanyMemberController(request: Request, response: Response): Promise<void> {
    const companyId = getCompanyId(request);
    const actorUserId = getAuthenticatedUserId(request);

    const member = await addCompanyMember({
        companyId,
        actorUserId,
        data: request.body,
    });

    response.status(201).json({
        success: true,
        message: "Company member added successfully.",
        member,
    });
}

export async function updateCompanyMemberRoleController(request: Request, response: Response): Promise<void> {
    const companyId = getCompanyId(request);
    const memberId = request.params.memberId;

    if (typeof memberId !== "string") {
        throw new AppError(400, "A valid member ID is required.");
    }

    const actorUserId = getAuthenticatedUserId(request);

    const member = await updateCompanyMemberRole({
        companyId,
        memberId,
        actorUserId,
        data: request.body,
    });

    response.status(200).json({
        success: true,
        message: "Company member role updated successfully.",
        member,
    });
}

export async function transferCompanyOwnershipController(
    request: Request,
    response: Response,
): Promise<void> {
    const companyId = getCompanyId(request);
    const actorUserId = getAuthenticatedUserId(request);

    const result = await transferCompanyOwnership({
        companyId,
        actorUserId,
        data: request.body,
    });

    response.status(200).json({
        success: true,
        message: "Company ownership transferred successfully.",
        ...result,
    });
}

export async function removeCompanyMemberController(request: Request, response: Response): Promise<void> {
    const companyId = getCompanyId(request);
    const memberId = request.params.memberId;

    if (typeof memberId !== "string") {
        throw new AppError(400, "A valid member ID is required.");
    }

    const actorUserId = getAuthenticatedUserId(request);

    await removeCompanyMember({
        companyId,
        memberId,
        actorUserId,
    });

    response.status(200).json({
        success: true,
        message: "Company member removed successfully.",
    });
}
