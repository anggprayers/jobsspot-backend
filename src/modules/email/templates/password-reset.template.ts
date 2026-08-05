import { emailConfig } from "../email.config.js";
import type {
    EmailActionTemplateInput,
    RenderedEmail,
} from "../email.types.js";
import { renderEmailLayout } from "./email-layout.js";

export function createPasswordResetTemplate({
    recipientName,
    actionUrl,
}: EmailActionTemplateInput): RenderedEmail {
    const subject =
        "Reset your JobsSpot password";

    const text = [
        `Hi ${recipientName},`,
        "",
        "We received a request to reset the password for your JobsSpot account.",
        "",
        `Reset password: ${actionUrl}`,
        "",
        `This single-use link expires in ${emailConfig.passwordResetTokenTtlMinutes} minutes.`,
        "If you did not request this reset, ignore this email. Your password will remain unchanged.",
    ].join("\n");

    const html = renderEmailLayout({
        previewText:
            "Reset the password for your JobsSpot account.",
        heading: "Reset your password",
        greeting: `Hi ${recipientName},`,
        bodyHtml: `
            <p style="margin: 0">
                We received a request to reset the password
                for your JobsSpot account.
            </p>

            <p style="margin: 14px 0 0">
                This single-use link expires in
                <strong>${emailConfig.passwordResetTokenTtlMinutes} minutes</strong>.
                After your password is changed, all existing
                JobsSpot sessions will be signed out.
            </p>
        `,
        actionLabel: "Reset password",
        actionUrl,
        footerNote:
            "If you did not request a password reset, ignore this email. Your password will remain unchanged.",
    });

    return {
        subject,
        html,
        text,
    };
}
