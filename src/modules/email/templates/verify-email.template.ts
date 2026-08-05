import { emailConfig } from "../email.config.js";
import type {
    EmailActionTemplateInput,
    RenderedEmail,
} from "../email.types.js";
import { renderEmailLayout } from "./email-layout.js";

export function createVerifyEmailTemplate({
    recipientName,
    actionUrl,
}: EmailActionTemplateInput): RenderedEmail {
    const subject =
        "Verify your JobsSpot email";

    const text = [
        `Hi ${recipientName},`,
        "",
        "Confirm your email address to secure your JobsSpot account.",
        "",
        `Verify email: ${actionUrl}`,
        "",
        `This single-use link expires in ${emailConfig.verificationTokenTtlMinutes} minutes.`,
        "If you did not create this JobsSpot account, you can ignore this email.",
    ].join("\n");

    const html = renderEmailLayout({
        previewText:
            "Confirm your email address for JobsSpot.",
        heading:
            "Verify your email address",
        greeting: `Hi ${recipientName},`,
        bodyHtml: `
            <p style="margin: 0">
                Click the button below to confirm your email
                address and secure your JobsSpot account.
            </p>

            <p style="margin: 14px 0 0">
                This single-use link expires in
                <strong>${emailConfig.verificationTokenTtlMinutes} minutes</strong>.
            </p>
        `,
        actionLabel: "Verify email",
        actionUrl,
        footerNote:
            "You received this message because a JobsSpot account was created using this email address. Ignore it if this was not you.",
    });

    return {
        subject,
        html,
        text,
    };
}
