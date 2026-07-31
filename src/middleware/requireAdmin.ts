import type { NextFunction, Request, Response } from "express";

import { AppError } from "../errors/AppError.js";

export function requireAdmin(request: Request, _response: Response, next: NextFunction): void {
    if (!request.user) {
        throw new AppError(401, "Authentication is required.");
    }

    if (!request.user.isAdmin) {
        throw new AppError(403, "Administrator access is required.");
    }

    next();
}
