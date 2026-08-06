import { randomUUID } from "node:crypto";

import { AppError } from "../../errors/AppError.js";
import { emailConfig } from "../email/email.config.js";
import { sendTransactionalEmail } from "../email/email.service.js";
import { createContactConfirmationTemplate } from "../email/templates/contact-confirmation.template.js";
import { createContactNotificationTemplate } from "../email/templates/contact-notification.template.js";

import type { ContactSubmissionInput } from "./contact.validation.js";

type SubmitContactMessageInput = ContactSubmissionInput & {
    ipAddress: string | null;
    userAgent: string | null;
};

const MAX_ALLOWED_LINKS = 3;

function countLinks(value: string): number {
    return (
        value.match(
            /(?:https?:\/\/|www\.)[^\s]+/gi,
        )?.length ?? 0
    );
}

function validateSpamSignals(
    input: ContactSubmissionInput,
): void {
    const linkCount =
        countLinks(input.subject) +
        countLinks(input.message);

    if (linkCount > MAX_ALLOWED_LINKS) {
        throw new AppError(
            400,
            "Please remove extra links and submit your message again.",
        );
    }
}

export async function submitContactMessage({
    name,
    email,
    inquiryType,
    subject,
    message,
    website,
    ipAddress,
    userAgent,
}: SubmitContactMessageInput) {
    const referenceId = randomUUID();
    const receivedAt = new Date();

    // Silently accept honeypot submissions without sending email so automated
    // spam clients do not learn which field caused the rejection.
    if (website.length > 0) {
        return {
            referenceId,
            receivedAt,
        };
    }

    validateSpamSignals({
        name,
        email,
        inquiryType,
        subject,
        message,
        website,
    });

    const notificationEmail =
        createContactNotificationTemplate({
            referenceId,
            receivedAt,
            name,
            email,
            inquiryType,
            subject,
            message,
            ipAddress,
            userAgent,
        });

    await sendTransactionalEmail({
        to: emailConfig.contactInbox,
        replyTo: email,
        ...notificationEmail,
        idempotencyKey: `contact-inbox:${referenceId}`,
    });

    const confirmationEmail =
        createContactConfirmationTemplate({
            referenceId,
            name,
            subject,
            inquiryType,
        });

    try {
        await sendTransactionalEmail({
            to: email,
            ...confirmationEmail,
            idempotencyKey: `contact-confirmation:${referenceId}`,
        });
    } catch (error) {
        // The JobsSpot inbox already received the submission. A temporary
        // confirmation-email failure should not ask the user to submit twice.
        console.error(
            "Contact submission was delivered, but the confirmation email failed.",
            {
                referenceId,
                recipient: email,
                error:
                    error instanceof Error
                        ? error.message
                        : String(error),
            },
        );
    }

    return {
        referenceId,
        receivedAt,
    };
}
