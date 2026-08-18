import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import {
    loginRateLimiter,
    refreshRateLimiter,
    registerRateLimiter,
    sensitiveAccountRateLimiter,
} from "../../middleware/rateLimit.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { validate } from "../../middleware/validate.js";

import {
    changePassword,
    deleteAccount,
    forgotPassword,
    getCurrentUser,
    googleLogin,
    login,
    logout,
    refresh,
    register,
    resetPassword,
    sendVerificationEmail,
    updateProfile,
    verifyEmail,
} from "./auth.controller.js";

import {
    changePasswordSchema,
    deleteAccountSchema,
    forgotPasswordSchema,
    googleLoginSchema,
    loginSchema,
    registerSchema,
    resetPasswordSchema,
    updateProfileSchema,
    verifyEmailSchema,
} from "./auth.validation.js";

const authRouter = Router();

// POST /api/auth/register
// Create a new JobsSpot user account and attempt to send its first verification email.
authRouter.post(
    "/register",
    registerRateLimiter,
    validate(registerSchema),
    asyncHandler(register),
);

// POST /api/auth/login
// Authenticate a user and create an access/refresh-token session.
authRouter.post(
    "/login",
    loginRateLimiter,
    validate(loginSchema),
    asyncHandler(login),
);

// POST /api/auth/google
// Verify a Google ID token, create or link the JobsSpot account,
// and issue the standard JobsSpot access/refresh-token session.
authRouter.post(
    "/google",
    loginRateLimiter,
    validate(googleLoginSchema),
    asyncHandler(googleLogin),
);

// POST /api/auth/refresh
// Refresh the authenticated session and rotate the refresh token.
authRouter.post(
    "/refresh",
    refreshRateLimiter,
    asyncHandler(refresh),
);

// POST /api/auth/logout
// Revoke the current refresh-token session and clear its cookie.
authRouter.post(
    "/logout",
    asyncHandler(logout),
);


// POST /api/auth/forgot-password
// Return a generic response and send a single-use reset link when eligible.
authRouter.post(
    "/forgot-password",
    sensitiveAccountRateLimiter,
    validate(forgotPasswordSchema),
    asyncHandler(forgotPassword),
);

// POST /api/auth/reset-password
// Consume a single-use token, change the password, and revoke active sessions.
authRouter.post(
    "/reset-password",
    sensitiveAccountRateLimiter,
    validate(resetPasswordSchema),
    asyncHandler(resetPassword),
);

// POST /api/auth/email-verification/verify
// Verify one email address using a single-use token from the email link.
authRouter.post(
    "/email-verification/verify",
    sensitiveAccountRateLimiter,
    validate(verifyEmailSchema),
    asyncHandler(verifyEmail),
);

// GET /api/auth/me
// Retrieve the currently authenticated user and company memberships.
authRouter.get(
    "/me",
    asyncHandler(requireAuth),
    asyncHandler(getCurrentUser),
);

// PATCH /api/auth/profile
// Update the authenticated user's personal profile information.
authRouter.patch(
    "/profile",
    asyncHandler(requireAuth),
    validate(updateProfileSchema),
    asyncHandler(updateProfile),
);

// POST /api/auth/email-verification/send
// Send or replace the authenticated user's active verification link.
authRouter.post(
    "/email-verification/send",
    asyncHandler(requireAuth),
    sensitiveAccountRateLimiter,
    asyncHandler(sendVerificationEmail),
);

// PATCH /api/auth/change-password
// Change the authenticated user's password and revoke active sessions.
authRouter.patch(
    "/change-password",
    asyncHandler(requireAuth),
    sensitiveAccountRateLimiter,
    validate(changePasswordSchema),
    asyncHandler(changePassword),
);

// POST /api/auth/account-deletion
// Permanently disable the authenticated account, anonymize personal data, and remove private files.
authRouter.post(
    "/account-deletion",
    asyncHandler(requireAuth),
    sensitiveAccountRateLimiter,
    validate(deleteAccountSchema),
    asyncHandler(deleteAccount),
);

export default authRouter;
