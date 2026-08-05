import type { Request, Response } from "express";

import { AppError } from "../../errors/AppError.js";

import {
    cancelCompanyInvitation,
    createCompanyInvitation,
    getCompanyInvitations,
    resendCompanyInvitation,
} from "./company-invitation.service.js";

function getAuthenticatedUserId(
    request: Request,
): string {
    if (!request.user) {
        throw new AppError(
            401,
            "Authentication is required.",
        );
    }

    return request.user.id;
}

function getCompanyId(
    request: Request,
): string {
    const companyId = request.params.companyId;

    if (typeof companyId !== "string") {
        throw new AppError(
            400,
            "A valid company ID is required.",
        );
    }

    return companyId;
}

function getInvitationId(
    request: Request,
): string {
    const invitationId =
        request.params.invitationId;

    if (typeof invitationId !== "string") {
        throw new AppError(
            400,
            "A valid invitation ID is required.",
        );
    }

    return invitationId;
}

export async function getCompanyInvitationsController(
    request: Request,
    response: Response,
): Promise<void> {
    const invitations =
        await getCompanyInvitations({
            companyId: getCompanyId(request),
            actorUserId:
                getAuthenticatedUserId(request),
        });

    response.status(200).json({
        success: true,
        message:
            "Company invitations retrieved successfully.",
        invitations,
    });
}

export async function createCompanyInvitationController(
    request: Request,
    response: Response,
): Promise<void> {
    const invitation =
        await createCompanyInvitation({
            companyId: getCompanyId(request),
            actorUserId:
                getAuthenticatedUserId(request),
            data: request.body,
        });

    response.status(201).json({
        success: true,
        message:
            "Company invitation sent successfully.",
        invitation,
    });
}

export async function resendCompanyInvitationController(
    request: Request,
    response: Response,
): Promise<void> {
    const invitation =
        await resendCompanyInvitation({
            companyId: getCompanyId(request),
            invitationId:
                getInvitationId(request),
            actorUserId:
                getAuthenticatedUserId(request),
        });

    response.status(200).json({
        success: true,
        message:
            "Company invitation resent successfully.",
        invitation,
    });
}

export async function cancelCompanyInvitationController(
    request: Request,
    response: Response,
): Promise<void> {
    const invitation =
        await cancelCompanyInvitation({
            companyId: getCompanyId(request),
            invitationId:
                getInvitationId(request),
            actorUserId:
                getAuthenticatedUserId(request),
        });

    response.status(200).json({
        success: true,
        message:
            "Company invitation cancelled successfully.",
        invitation,
    });
}
