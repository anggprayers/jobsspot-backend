import type { ErrorRequestHandler } from "express";
import multer from "multer";

import { env } from "../config/env.js";
import { AppError } from "./AppError.js";

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
    if (error instanceof AppError) {
        if (error.headers) {
            response.set(error.headers);
        }

        response.status(error.statusCode).json({
            success: false,
            message: error.message,
            ...(error.details ?? {}),
        });

        return;
    }

    if (error instanceof multer.MulterError) {
        const message =
            error.code === "LIMIT_FILE_SIZE"
                ? "The uploaded file exceeds the allowed size."
                : error.code === "LIMIT_FILE_COUNT"
                  ? "Only one file may be uploaded at a time."
                  : error.code === "LIMIT_UNEXPECTED_FILE"
                    ? "The uploaded file field is invalid."
                    : "The file upload could not be processed.";

        response.status(400).json({
            success: false,
            message,
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
