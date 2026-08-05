import type { Request, Response } from "express";

import { AppError } from "../../errors/AppError.js";

import {
    acceptCompanyInvitation,
    resolveCompanyInvitation,
} from "./company-invitation-acceptance.service.js";
import type { ResolveCompanyInvitationQuery } from "./company-invitation-acceptance.validation.js";

function setNoStoreHeaders(
    response: Response,
): void {
    response.set({
        "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "Surrogate-Control": "no-store",
    });
}

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

export async function resolveCompanyInvitationController(
    _request: Request,
    response: Response,
): Promise<void> {
    const query =
        response.locals.validatedQuery as ResolveCompanyInvitationQuery;

    const invitation =
        await resolveCompanyInvitation(
            query.token,
        );

    setNoStoreHeaders(response);

    response.status(200).json({
        success: true,
        message:
            "Company invitation details retrieved successfully.",
        invitation,
    });
}

export async function acceptCompanyInvitationController(
    request: Request,
    response: Response,
): Promise<void> {
    const result =
        await acceptCompanyInvitation({
            rawToken: request.body.token,
            actorUserId:
                getAuthenticatedUserId(request),
        });

    setNoStoreHeaders(response);

    response.status(200).json({
        success: true,
        message:
            result.membership.outcome ===
            "ALREADY_ACTIVE"
                ? "You already belong to this company. The invitation has been closed."
                : "Company invitation accepted successfully.",
        ...result,
    });
}
