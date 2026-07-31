import multer from "multer";

import { AppError } from "../errors/AppError.js";

const MAX_SIZE = 5 * 1024 * 1024;

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const storage = multer.memoryStorage();

const fileFilter: multer.Options["fileFilter"] = (_request, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
        callback(new AppError(400, "Only JPG, PNG and WebP images are allowed."));

        return;
    }

    callback(null, true);
};

export const uploadCompanyImage = multer({
    storage,

    limits: {
        fileSize: MAX_SIZE,
    },

    fileFilter,
});
