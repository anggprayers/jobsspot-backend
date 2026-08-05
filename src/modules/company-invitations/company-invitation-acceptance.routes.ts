import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { companyInvitationAccessRateLimiter } from "../../middleware/rateLimit.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireVerifiedEmail } from "../../middleware/requireVerifiedEmail.js";
import { validate } from "../../middleware/validate.js";
import { validateQuery } from "../../middleware/validateQuery.js";

import {
    acceptCompanyInvitationController,
    resolveCompanyInvitationController,
} from "./company-invitation-acceptance.controller.js";
import {
    acceptCompanyInvitationSchema,
    resolveCompanyInvitationQuerySchema,
} from "./company-invitation-acceptance.validation.js";

const companyInvitationAcceptanceRouter =
    Router();

// GET /api/company-invitations/resolve?token=...
// Resolve a private invitation token into safe details for the acceptance page.
companyInvitationAcceptanceRouter.get(
    "/resolve",
    companyInvitationAccessRateLimiter,
    validateQuery(
        resolveCompanyInvitationQuerySchema,
    ),
    asyncHandler(
        resolveCompanyInvitationController,
    ),
);

// POST /api/company-invitations/accept
// Accept an invitation using the authenticated, verified account whose email
// matches the invitation recipient.
companyInvitationAcceptanceRouter.post(
    "/accept",
    companyInvitationAccessRateLimiter,
    asyncHandler(requireAuth),
    asyncHandler(requireVerifiedEmail),
    validate(acceptCompanyInvitationSchema),
    asyncHandler(
        acceptCompanyInvitationController,
    ),
);

export default companyInvitationAcceptanceRouter;
