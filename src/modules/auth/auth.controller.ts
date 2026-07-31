import type { Request, Response } from "express";

import { AppError } from "../../errors/AppError.js";
import { clearRefreshTokenCookie, REFRESH_TOKEN_COOKIE_NAME, setRefreshTokenCookie } from "../../utils/cookie.js";

import {
    changeCurrentUserPassword,
    getCurrentUserProfile,
    loginUser,
    logoutUser,
    refreshUserSession,
    registerUser,
    updateCurrentUserProfile,
} from "./auth.service.js";

function setNoStoreHeaders(response: Response): void {
    response.set({
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "Surrogate-Control": "no-store",
    });
}

export async function register(request: Request, response: Response): Promise<void> {
    const user = await registerUser(request.body);

    response.status(201).json({
        success: true,
        message: "Account created successfully.",
        user,
    });
}

export async function login(request: Request, response: Response): Promise<void> {
    const result = await loginUser(request.body);

    setRefreshTokenCookie(response, result.refreshToken);

    setNoStoreHeaders(response);

    response.status(200).json({
        success: true,
        message: "Login successful.",
        user: result.user,
        accessToken: result.accessToken,
    });
}

export async function refresh(request: Request, response: Response): Promise<void> {
    const refreshToken = request.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

    setNoStoreHeaders(response);

    if (!refreshToken) {
        response.status(200).json({
            success: true,
            authenticated: false,
            message: "No active session.",
        });

        return;
    }

    const result = await refreshUserSession(refreshToken);

    setRefreshTokenCookie(response, result.refreshToken);

    response.status(200).json({
        success: true,
        authenticated: true,
        message: "Session refreshed successfully.",
        user: result.user,
        accessToken: result.accessToken,
    });
}

export async function logout(request: Request, response: Response): Promise<void> {
    const refreshToken = request.cookies?.[REFRESH_TOKEN_COOKIE_NAME];

    if (refreshToken) {
        await logoutUser(refreshToken);
    }

    clearRefreshTokenCookie(response);
    setNoStoreHeaders(response);

    response.status(200).json({
        success: true,
        message: "Logged out successfully.",
    });
}

export async function getCurrentUser(request: Request, response: Response): Promise<void> {
    if (!request.user) {
        throw new AppError(401, "Authentication is required.");
    }

    setNoStoreHeaders(response);

    const user = await getCurrentUserProfile(request.user.id);

    response.status(200).json({
        success: true,
        message: "Current user retrieved successfully.",
        user,
    });
}

export async function updateProfile(request: Request, response: Response): Promise<void> {
    if (!request.user) {
        throw new AppError(401, "Authentication is required.");
    }

    const user = await updateCurrentUserProfile(request.user.id, request.body);

    setNoStoreHeaders(response);

    response.status(200).json({
        success: true,
        message: "Profile updated successfully.",
        user,
    });
}

export async function changePassword(request: Request, response: Response): Promise<void> {
    if (!request.user) {
        throw new AppError(401, "Authentication is required.");
    }

    const result = await changeCurrentUserPassword(request.user.id, request.body);

    clearRefreshTokenCookie(response);
    setNoStoreHeaders(response);

    response.status(200).json({
        success: true,
        message: "Password changed successfully. Please sign in again.",
        requiresReauthentication: true,
        revokedSessions: result.revokedSessions,
    });
}
