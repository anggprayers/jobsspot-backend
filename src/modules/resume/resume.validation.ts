import { z } from "zod";

function parseOptionalBoolean(value: unknown): unknown {
    if (value === undefined || value === "") {
        return undefined;
    }

    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "string") {
        const normalizedValue = value.trim().toLowerCase();

        if (normalizedValue === "true") {
            return true;
        }

        if (normalizedValue === "false") {
            return false;
        }
    }

    return value;
}

export const uploadResumeSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(1, "Resume name is required.")
            .max(100, "Resume name must not exceed 100 characters.")
            .optional(),

        isDefault: z.preprocess(
            parseOptionalBoolean,
            z
                .boolean({
                    error: "isDefault must be true or false.",
                })
                .optional(),
        ),
    })
    .strict();

export const renameResumeSchema = z
    .object({
        name: z
            .string()
            .trim()
            .min(1, "Resume name is required.")
            .max(100, "Resume name must not exceed 100 characters."),
    })
    .strict();

export type UploadResumeBody = z.infer<typeof uploadResumeSchema>;
export type RenameResumeBody = z.infer<typeof renameResumeSchema>;
