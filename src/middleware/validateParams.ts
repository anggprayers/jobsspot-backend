import type { NextFunction, Request, Response } from "express";
import { z, type ZodType } from "zod";

export function validateParams(schema: ZodType) {
    return (
        request: Request,
        response: Response,
        next: NextFunction,
    ): void => {
        const result = schema.safeParse(
            request.params,
        );

        if (!result.success) {
            response.status(400).json({
                success: false,
                message:
                    "Invalid route parameters.",
                errors: z.flattenError(
                    result.error,
                ).fieldErrors,
            });

            return;
        }

        next();
    };
}
