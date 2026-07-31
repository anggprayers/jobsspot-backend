import type { NextFunction, Request, Response } from "express";

import { AppError } from "../errors/AppError.js";
import { prisma } from "../lib/prisma.js";
import { verifyAccessToken } from "../utils/token.js";

export async function requireAuth(request: Request, _response: Response, next: NextFunction): Promise<void> {
    const authorizationHeader = request.headers.authorization;

    if (!authorizationHeader) {
        throw new AppError(401, "Authentication is required.");
    }

    const [scheme, accessToken] = authorizationHeader.split(" ");

    if (scheme !== "Bearer" || !accessToken) {
        throw new AppError(401, "Authorization header must use the Bearer token format.");
    }

    let payload;

    try {
        payload = verifyAccessToken(accessToken);
    } catch {
        throw new AppError(401, "Invalid or expired access token.");
    }

    const user = await prisma.user.findFirst({
        where: {
            id: payload.userId,
            deletedAt: null,
        },
        select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            isAdmin: true,
        },
    });

    if (!user) {
        throw new AppError(401, "Authenticated user no longer exists.");
    }

    if (user.email !== payload.email) {
        throw new AppError(401, "Access token user information is invalid.");
    }

    request.user = user;

    next();
}
