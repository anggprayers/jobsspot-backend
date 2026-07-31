import type { NextFunction, Request, Response } from "express";
import { z, type ZodType } from "zod";

export function validateQuery(schema: ZodType) {
    return (request: Request, response: Response, next: NextFunction): void => {
        const result = schema.safeParse(request.query);

        if (!result.success) {
            response.status(400).json({
                success: false,
                message: "Invalid query parameters.",
                errors: z.flattenError(result.error).fieldErrors,
            });

            return;
        }

        response.locals.validatedQuery = result.data;

        next();
    };
}
