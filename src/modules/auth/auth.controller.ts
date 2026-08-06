import type {
    Request,
    Response,
} from "express";

import { AppError } from "../../errors/AppError.js";
import {
    clearRefreshTokenCookie,
    REFRESH_TOKEN_COOKIE_NAME,
    setRefreshTokenCookie,
} from "../../utils/cookie.js";

import {
    changeCurrentUserPassword,
    createAuthenticatedUserSession,
    getCurrentUserProfile,
    loginUser,
    logoutUser,
    refreshUserSession,
    registerUser,
    updateCurrentUserProfile,
} from "./auth.service.js";
import {
    sendEmailVerificationForUser,
    verifyEmailAddress,
} from "./email-verification.service.js";
import {
    requestPasswordReset,
    resetUserPassword,
} from "./password-reset.service.js";
import { authenticateWithGoogle } from "./google-auth.service.js";

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

export async function register(
    request: Request,
    response: Response,
): Promise<void> {
    const user = await registerUser(
        request.body,
    );

    let verificationEmailSent = false;

    try {
        const verification =
            await sendEmailVerificationForUser(
                user.id,
            );

        verificationEmailSent =
            verification.emailSent;
    } catch (error) {
        console.error(
            "JobsSpot account was created, but the verification email could not be sent.",
            {
                userId: user.id,
                error:
                    error instanceof Error
                        ? error.message
                        : "Unknown email delivery error.",
            },
        );
    }

    response.status(201).json({
        success: true,
        message: verificationEmailSent
            ? "Account created successfully. Check your email to verify your address."
            : "Account created successfully. Sign in and request a verification email from Account Settings.",
        verificationEmailSent,
        user,
    });
}

export async function login(
    request: Request,
    response: Response,
): Promise<void> {
    const result = await loginUser(
        request.body,
    );

    setRefreshTokenCookie(
        response,
        result.refreshToken,
    );

    setNoStoreHeaders(response);

    response.status(200).json({
        success: true,
        message: "Login successful.",
        user: result.user,
        accessToken: result.accessToken,
    });
}

export async function googleLogin(
    request: Request,
    response: Response,
): Promise<void> {
    const authentication =
        await authenticateWithGoogle(
            request.body.credential,
        );

    const session =
        await createAuthenticatedUserSession(
            authentication.userId,
        );

    setRefreshTokenCookie(
        response,
        session.refreshToken,
    );

    setNoStoreHeaders(response);

    response.status(200).json({
        success: true,
        message:
            authentication.isNewUser
                ? "Google account created successfully. Welcome to JobsSpot."
                : authentication.accountLinked
                  ? "Google account linked successfully. Welcome back."
                  : "Google sign-in successful.",
        provider: "GOOGLE",
        isNewUser:
            authentication.isNewUser,
        accountLinked:
            authentication.accountLinked,
        user: session.user,
        accessToken:
            session.accessToken,
    });
}

export async function refresh(
    request: Request,
    response: Response,
): Promise<void> {
    const refreshToken =
        request.cookies?.[
            REFRESH_TOKEN_COOKIE_NAME
        ];

    setNoStoreHeaders(response);

    if (!refreshToken) {
        response.status(200).json({
            success: true,
            authenticated: false,
            message: "No active session.",
        });

        return;
    }

    try {
        const result =
            await refreshUserSession(
                refreshToken,
            );

        setRefreshTokenCookie(
            response,
            result.refreshToken,
        );

        response.status(200).json({
            success: true,
            authenticated: true,
            message:
                "Session refreshed successfully.",
            user: result.user,
            accessToken: result.accessToken,
        });
    } catch (error) {
        if (
            error instanceof AppError &&
            (error.statusCode === 401 || error.statusCode === 403)
        ) {
            clearRefreshTokenCookie(response);

            response.status(200).json({
                success: true,
                authenticated: false,
                message: "No active session.",
            });

            return;
        }

        throw error;
    }
}

export async function logout(
    request: Request,
    response: Response,
): Promise<void> {
    const refreshToken =
        request.cookies?.[
            REFRESH_TOKEN_COOKIE_NAME
        ];

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

export async function getCurrentUser(
    request: Request,
    response: Response,
): Promise<void> {
    if (!request.user) {
        throw new AppError(
            401,
            "Authentication is required.",
        );
    }

    setNoStoreHeaders(response);

    const user =
        await getCurrentUserProfile(
            request.user.id,
        );

    response.status(200).json({
        success: true,
        message:
            "Current user retrieved successfully.",
        user,
    });
}

export async function updateProfile(
    request: Request,
    response: Response,
): Promise<void> {
    if (!request.user) {
        throw new AppError(
            401,
            "Authentication is required.",
        );
    }

    const user =
        await updateCurrentUserProfile(
            request.user.id,
            request.body,
        );

    setNoStoreHeaders(response);

    response.status(200).json({
        success: true,
        message:
            "Profile updated successfully.",
        user,
    });
}

export async function changePassword(
    request: Request,
    response: Response,
): Promise<void> {
    if (!request.user) {
        throw new AppError(
            401,
            "Authentication is required.",
        );
    }

    const result =
        await changeCurrentUserPassword(
            request.user.id,
            request.body,
        );

    clearRefreshTokenCookie(response);
    setNoStoreHeaders(response);

    response.status(200).json({
        success: true,
        message:
            "Password changed successfully. Please sign in again.",
        requiresReauthentication: true,
        revokedSessions:
            result.revokedSessions,
    });
}

export async function sendVerificationEmail(
    request: Request,
    response: Response,
): Promise<void> {
    if (!request.user) {
        throw new AppError(
            401,
            "Authentication is required.",
        );
    }

    const result =
        await sendEmailVerificationForUser(
            request.user.id,
        );

    setNoStoreHeaders(response);

    response.status(200).json({
        success: true,
        message: result.alreadyVerified
            ? "Your email address is already verified."
            : "Verification email sent. Check your inbox for a link that expires in 30 minutes.",
        emailSent: result.emailSent,
        alreadyVerified:
            result.alreadyVerified,
        expiresAt:
            result.expiresAt?.toISOString() ??
            null,
    });
}

export async function verifyEmail(
    request: Request,
    response: Response,
): Promise<void> {
    const verification =
        await verifyEmailAddress(
            request.body.token,
        );

    setNoStoreHeaders(response);

    if (verification.alreadyVerified) {
        response.status(200).json({
            success: true,
            message:
                "This email address is already verified.",
            isEmailVerified: true,
            alreadyVerified: true,
            authenticated: false,
            accessToken: null,
            user: null,
            redirectTo: null,
        });

        return;
    }

    const session =
        await createAuthenticatedUserSession(
            verification.userId,
        );

    setRefreshTokenCookie(
        response,
        session.refreshToken,
    );

    response.status(200).json({
        success: true,
        message:
            "Email address verified successfully. Welcome to JobsSpot.",
        isEmailVerified: true,
        alreadyVerified: false,
        authenticated: true,
        accessToken:
            session.accessToken,
        user: session.user,
        redirectTo: "/jobs",
    });
}


export async function forgotPassword(
    request: Request,
    response: Response,
): Promise<void> {
    await requestPasswordReset(
        request.body.email,
    );

    setNoStoreHeaders(response);

    response.status(200).json({
        success: true,
        message:
            "If an account exists for that email address, a password reset link has been sent.",
    });
}

export async function resetPassword(
    request: Request,
    response: Response,
): Promise<void> {
    const result =
        await resetUserPassword(
            request.body,
        );

    clearRefreshTokenCookie(response);
    setNoStoreHeaders(response);

    response.status(200).json({
        success: true,
        message:
            "Password reset successfully. Please sign in with your new password.",
        requiresReauthentication: true,
        revokedSessions:
            result.revokedSessions,
        redirectTo:
            "/login?passwordReset=success",
    });
}
