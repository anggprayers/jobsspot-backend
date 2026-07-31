import type { CookieOptions, Response } from "express";

import { env } from "../config/env.js";

export const REFRESH_TOKEN_COOKIE_NAME = "refreshToken";

const SEVEN_DAYS_IN_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;

export function getRefreshTokenCookieOptions(): CookieOptions {
    const isProduction = env.NODE_ENV === "production";

    return {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        path: "/api/auth",
        maxAge: SEVEN_DAYS_IN_MILLISECONDS,
    };
}

export function setRefreshTokenCookie(response: Response, refreshToken: string): void {
    response.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, getRefreshTokenCookieOptions());
}

export function clearRefreshTokenCookie(response: Response): void {
    const options = getRefreshTokenCookieOptions();

    response.clearCookie(REFRESH_TOKEN_COOKIE_NAME, {
        httpOnly: options.httpOnly,
        secure: options.secure,
        sameSite: options.sameSite,
        path: options.path,
    });
}
