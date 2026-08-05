import type {
    NextFunction,
    Request,
    Response,
} from "express";

import { AppError } from "../errors/AppError.js";
import { prisma } from "../lib/prisma.js";

export async function requireVerifiedEmail(
    request: Request,
    _response: Response,
    next: NextFunction,
): Promise<void> {
    if (!request.user) {
        throw new AppError(
            401,
            "Authentication is required.",
        );
    }

    const user = await prisma.user.findFirst({
        where: {
            id: request.user.id,
            deletedAt: null,
        },

        select: {
            isEmailVerified: true,
        },
    });

    if (!user) {
        throw new AppError(
            401,
            "User account no longer exists.",
        );
    }

    if (!user.isEmailVerified) {
        throw new AppError(
            403,
            "Verify your email address to continue.",
        );
    }

    next();
}
