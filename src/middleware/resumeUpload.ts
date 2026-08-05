import path from "node:path";

import multer from "multer";

import { AppError } from "../errors/AppError.js";

const MAX_SIZE = 5 * 1024 * 1024;

const allowedResumeTypes = new Map<string, Set<string>>([
    [".pdf", new Set(["application/pdf", "application/octet-stream"])],
    [".doc", new Set(["application/msword", "application/octet-stream"])],
    [
        ".docx",
        new Set([
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/zip",
            "application/octet-stream",
        ]),
    ],
]);

const storage = multer.memoryStorage();

const fileFilter: multer.Options["fileFilter"] = (_request, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();

    const allowedMimeTypes = allowedResumeTypes.get(extension);

    if (!allowedMimeTypes || !allowedMimeTypes.has(file.mimetype)) {
        callback(new AppError(400, "Only PDF, DOC, and DOCX resume files are allowed."));

        return;
    }

    callback(null, true);
};

export const uploadResume = multer({
    storage,

    limits: {
        files: 1,
        fileSize: MAX_SIZE,
    },

    fileFilter,
});
