import { Router } from "express";

import { CompanyMemberRole } from "../../generated/prisma/client.js";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireCompanyRole } from "../../middleware/requireCompanyRole.js";
import { requireVerifiedEmail } from "../../middleware/requireVerifiedEmail.js";
import { teamInvitationRateLimiter } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";
import { validateParams } from "../../middleware/validateParams.js";

import {
    cancelCompanyInvitationController,
    createCompanyInvitationController,
    getCompanyInvitationsController,
    resendCompanyInvitationController,
} from "./company-invitation.controller.js";
import {
    companyInvitationCompanyParamsSchema,
    companyInvitationResourceParamsSchema,
    createCompanyInvitationSchema,
} from "./company-invitation.validation.js";

const companyInvitationRouter = Router({
    mergeParams: true,
});

const managingRoles = [
    CompanyMemberRole.OWNER,
    CompanyMemberRole.ADMIN,
];

companyInvitationRouter.use(
    asyncHandler(requireAuth),
    asyncHandler(requireVerifiedEmail),
    validateParams(
        companyInvitationCompanyParamsSchema,
    ),
    requireCompanyRole(managingRoles),
);

// GET /api/companies/:companyId/invitations
// Retrieve active and expired invitations that have not been accepted or cancelled.
companyInvitationRouter.get(
    "/",
    asyncHandler(
        getCompanyInvitationsController,
    ),
);

// POST /api/companies/:companyId/invitations
// Invite an email address to join the company as Admin, Recruiter, or Viewer.
companyInvitationRouter.post(
    "/",
    teamInvitationRateLimiter,
    validate(createCompanyInvitationSchema),
    asyncHandler(
        createCompanyInvitationController,
    ),
);

// POST /api/companies/:companyId/invitations/:invitationId/resend
// Rotate the single-use token and extend the invitation for another seven days.
companyInvitationRouter.post(
    "/:invitationId/resend",
    validateParams(
        companyInvitationResourceParamsSchema,
    ),
    teamInvitationRateLimiter,
    asyncHandler(
        resendCompanyInvitationController,
    ),
);

// DELETE /api/companies/:companyId/invitations/:invitationId
// Cancel an invitation so its token can no longer be accepted.
companyInvitationRouter.delete(
    "/:invitationId",
    validateParams(
        companyInvitationResourceParamsSchema,
    ),
    asyncHandler(
        cancelCompanyInvitationController,
    ),
);

export default companyInvitationRouter;
