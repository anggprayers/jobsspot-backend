import { rateLimit } from "express-rate-limit";

type CreateRateLimiterOptions = {
    windowMs: number;
    limit: number;
    message: string;
    skipSuccessfulRequests?: boolean;
};

function createRateLimiter({ windowMs, limit, message, skipSuccessfulRequests = false }: CreateRateLimiterOptions) {
    return rateLimit({
        windowMs,
        limit,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        skipSuccessfulRequests,
        handler: (_request, response) => {
            response.status(429).json({
                success: false,
                message,
            });
        },
    });
}

const FIFTEEN_MINUTES = 15 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;

export const apiRateLimiter = createRateLimiter({
    windowMs: FIFTEEN_MINUTES,
    limit: 500,
    message: "Too many requests. Please wait a few minutes and try again.",
});

export const registerRateLimiter = createRateLimiter({
    windowMs: ONE_HOUR,
    limit: 5,
    message: "Too many registration attempts. Please try again later.",
});

export const loginRateLimiter = createRateLimiter({
    windowMs: FIFTEEN_MINUTES,
    limit: 10,
    message: "Too many failed login attempts. Please wait before trying again.",
    skipSuccessfulRequests: true,
});

export const refreshRateLimiter = createRateLimiter({
    windowMs: FIFTEEN_MINUTES,
    limit: 60,
    message: "Too many session refresh attempts. Please sign in again shortly.",
});

export const sensitiveAccountRateLimiter = createRateLimiter({
    windowMs: ONE_HOUR,
    limit: 5,
    message: "Too many account security requests. Please try again later.",
});

export const companyCreationRateLimiter = createRateLimiter({
    windowMs: ONE_HOUR,
    limit: 5,
    message: "Too many company creation attempts. Please try again later.",
});

export const fileUploadRateLimiter = createRateLimiter({
    windowMs: ONE_HOUR,
    limit: 20,
    message: "Too many file uploads. Please wait before uploading another file.",
});

export const teamInvitationRateLimiter = createRateLimiter({
    windowMs: ONE_HOUR,
    limit: 20,
    message: "Too many team invitation requests. Please try again later.",
});

export const companyInvitationAccessRateLimiter = createRateLimiter({
    windowMs: ONE_HOUR,
    limit: 30,
    message:
        "Too many company invitation link attempts. Please wait before trying again.",
    skipSuccessfulRequests: true,
});
export const contactRateLimiter = createRateLimiter({
    windowMs: ONE_HOUR,
    limit: 5,
    message:
        "Too many contact requests. Please wait before sending another message.",
});

export const platformAdminMutationRateLimiter = createRateLimiter({
    windowMs: ONE_HOUR,
    limit: 100,
    message: "Too many platform moderation changes. Please wait before trying again.",
});
