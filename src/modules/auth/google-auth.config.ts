import { z } from "zod";

const googleAuthEnvironmentSchema = z.object({
    GOOGLE_CLIENT_ID: z
        .string()
        .trim()
        .min(
            1,
            "GOOGLE_CLIENT_ID is required.",
        )
        .regex(
            /\.apps\.googleusercontent\.com$/,
            "GOOGLE_CLIENT_ID must be a valid Google OAuth web client ID.",
        ),
});

const result =
    googleAuthEnvironmentSchema.safeParse(
        process.env,
    );

if (!result.success) {
    console.error(
        "Invalid JobsSpot Google authentication configuration:",
        result.error.flatten().fieldErrors,
    );

    throw new Error(
        "JobsSpot Google authentication environment variables are invalid.",
    );
}

export const googleAuthConfig = {
    clientId:
        result.data.GOOGLE_CLIENT_ID,
} as const;
