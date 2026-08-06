import type { Request, Response } from "express";

import { submitContactMessage } from "./contact.service.js";
import type { ContactSubmissionInput } from "./contact.validation.js";

function getRequestIp(request: Request): string | null {
    const forwardedFor = request.headers["x-forwarded-for"];

    if (typeof forwardedFor === "string") {
        return forwardedFor.split(",")[0]?.trim() || null;
    }

    if (Array.isArray(forwardedFor)) {
        return forwardedFor[0]?.trim() || null;
    }

    return request.ip || null;
}

export async function submitContactMessageController(
    request: Request,
    response: Response,
): Promise<void> {
    const input = request.body as ContactSubmissionInput;

    const result = await submitContactMessage({
        ...input,
        ipAddress: getRequestIp(request),
        userAgent: request.get("user-agent") ?? null,
    });

    response.status(202).json({
        success: true,
        message:
            "Thanks for contacting JobsSpot. We received your message and will reply as soon as possible.",
        referenceId: result.referenceId,
        receivedAt: result.receivedAt.toISOString(),
    });
}
