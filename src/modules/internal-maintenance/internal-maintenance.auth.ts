import { timingSafeEqual } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

import { env } from "../../config/env.js";

function secretsMatch(received: string, expected: string): boolean {
    const receivedBuffer = Buffer.from(received);
    const expectedBuffer = Buffer.from(expected);

    if (receivedBuffer.length !== expectedBuffer.length) {
        return false;
    }

    return timingSafeEqual(receivedBuffer, expectedBuffer);
}

export function requireInternalCronSecret(
    request: Request,
    response: Response,
    next: NextFunction,
): void {
    const authorization = request.header("authorization") ?? "";
    const prefix = "Bearer ";

    if (!authorization.startsWith(prefix)) {
        response.status(401).json({
            success: false,
            message: "Internal maintenance authentication is required.",
        });
        return;
    }

    const receivedSecret = authorization.slice(prefix.length).trim();

    if (!receivedSecret || !secretsMatch(receivedSecret, env.INTERNAL_CRON_SECRET)) {
        response.status(403).json({
            success: false,
            message: "Invalid internal maintenance credentials.",
        });
        return;
    }

    next();
}
