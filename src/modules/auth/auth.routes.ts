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

import { changePassword, getCurrentUser, login, logout, refresh, register, updateProfile } from "./auth.controller.js";

import { changePasswordSchema, loginSchema, registerSchema, updateProfileSchema } from "./auth.validation.js";

const authRouter = Router();

// POST /api/auth/register
// Create a new JobsSpot user account.
authRouter.post("/register", registerRateLimiter, validate(registerSchema), asyncHandler(register));

// POST /api/auth/login
// Authenticate a user and create an access/refresh-token session.
authRouter.post("/login", loginRateLimiter, validate(loginSchema), asyncHandler(login));

// POST /api/auth/refresh
// Refresh the authenticated session and rotate the refresh token.
authRouter.post("/refresh", refreshRateLimiter, asyncHandler(refresh));

// POST /api/auth/logout
// Revoke the current refresh-token session and clear its cookie.
authRouter.post("/logout", asyncHandler(logout));

// GET /api/auth/me
// Retrieve the currently authenticated user and company memberships.
authRouter.get("/me", asyncHandler(requireAuth), asyncHandler(getCurrentUser));

// PATCH /api/auth/profile
// Update the authenticated user's personal profile information.
authRouter.patch("/profile", asyncHandler(requireAuth), validate(updateProfileSchema), asyncHandler(updateProfile));

// PATCH /api/auth/change-password
// Change the authenticated user's password and revoke active sessions.
authRouter.patch(
    "/change-password",
    asyncHandler(requireAuth),
    sensitiveAccountRateLimiter,
    validate(changePasswordSchema),
    asyncHandler(changePassword),
);

export default authRouter;
