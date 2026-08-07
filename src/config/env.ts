import "dotenv/config";

import { z } from "zod";

const envSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    PORT: z.coerce.number().int().positive().default(4000),

    FRONTEND_URL: z.url(),

    DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),

    JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must contain at least 32 characters."),

    JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must contain at least 32 characters."),

    JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),

    JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),

    CLOUDINARY_CLOUD_NAME: z.string().min(1),

    CLOUDINARY_API_KEY: z.string().min(1),

    CLOUDINARY_API_SECRET: z.string().min(1),

    R2_ACCOUNT_ID: z.string().min(1, "R2_ACCOUNT_ID is required."),

    R2_ACCESS_KEY_ID: z.string().min(1, "R2_ACCESS_KEY_ID is required."),

    R2_SECRET_ACCESS_KEY: z.string().min(1, "R2_SECRET_ACCESS_KEY is required."),

    R2_BUCKET_NAME: z.string().min(1, "R2_BUCKET_NAME is required."),

    INTERNAL_CRON_SECRET: z
        .string()
        .min(32, "INTERNAL_CRON_SECRET must contain at least 32 characters."),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
    console.error("Invalid environment variables:");
    console.error(z.treeifyError(result.error));

    process.exit(1);
}

export const env = result.data;
