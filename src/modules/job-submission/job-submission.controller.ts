import type { Request, Response } from "express";

import { submitPublicJob } from "./job-submission.service.js";
import type { PublicJobSubmissionInput } from "./job-submission.validation.js";

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

export async function submitPublicJobController(
    request: Request,
    response: Response,
): Promise<void> {
    const result = await submitPublicJob({
        data: request.body as PublicJobSubmissionInput,
        ipAddress: getRequestIp(request),
        userAgent: request.get("user-agent") ?? null,
    });

    response.status(201).json({
        success: true,
        message:
            "Your job submission was received. JobsSpot will review the details and contact you about the next steps before publication.",
        submission: {
            referenceCode: result.referenceCode,
            status: result.status,
            receivedAt: result.receivedAt.toISOString(),
        },
    });
}
