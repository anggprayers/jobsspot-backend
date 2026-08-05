import { AppError } from "../../errors/AppError.js";
import { resend } from "../../lib/resend.js";

import { emailConfig } from "./email.config.js";
import type { TransactionalEmail } from "./email.types.js";

function normalizeRecipients(
    recipients: string | string[],
): string[] {
    return Array.isArray(recipients)
        ? recipients
        : [recipients];
}

export async function sendTransactionalEmail({
    to,
    subject,
    html,
    text,
    idempotencyKey,
    replyTo = emailConfig.replyTo,
}: TransactionalEmail) {
    const recipients = normalizeRecipients(to);

    if (recipients.length === 0) {
        throw new AppError(
            500,
            "At least one email recipient is required.",
        );
    }

    const { data, error } = await resend.emails.send(
        {
            from: emailConfig.from,
            to: recipients,
            replyTo,
            subject,
            html,
            text,
        },
        idempotencyKey
            ? {
                  idempotencyKey,
              }
            : undefined,
    );

    if (error) {
        console.error(
            "Unable to send a JobsSpot transactional email.",
            {
                errorName: error.name,
                errorMessage: error.message,
                subject,
                recipientCount: recipients.length,
            },
        );

        throw new AppError(
            502,
            "Unable to send the email right now. Please try again.",
        );
    }

    if (!data?.id) {
        console.error(
            "Resend returned no email ID.",
            {
                subject,
                recipientCount: recipients.length,
            },
        );

        throw new AppError(
            502,
            "Unable to confirm email delivery. Please try again.",
        );
    }

    return {
        emailId: data.id,
    };
}
