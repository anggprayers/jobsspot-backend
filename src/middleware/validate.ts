import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";
import { z } from "zod";

export function validate(schema: ZodType) {
    return (request: Request, response: Response, next: NextFunction): void => {
        const result = schema.safeParse(request.body);

        if (!result.success) {
            const { fieldErrors, formErrors } = z.flattenError(result.error);

            response.status(400).json({
                success: false,
                message: "Validation failed.",
                errors: {
                    ...fieldErrors,

                    ...(formErrors.length > 0 && {
                        body: formErrors,
                    }),
                },
            });

            return;
        }

        request.body = result.data;

        next();
    };
}
