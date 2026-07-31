import type { ErrorRequestHandler } from "express";

import { env } from "../config/env.js";
import { AppError } from "./AppError.js";

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof AppError) {
        response.status(error.statusCode).json({
            success: false,
            message: error.message,
        });

        return;
    }

    console.error(error);

    response.status(500).json({
        success: false,
        message: "Internal server error.",
        ...(env.NODE_ENV === "development" && {
            error: error instanceof Error ? error.message : String(error),
        }),
    });
};
