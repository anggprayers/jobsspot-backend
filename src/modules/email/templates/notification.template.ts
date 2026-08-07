import type { RenderedEmail } from "../email.types.js";
import { escapeHtml, renderEmailLayout } from "./email-layout.js";

type NotificationEmailTemplateInput = {
    recipientName: string;
    title: string;
    message: string;
    actionUrl?: string | null;
};

function sanitizeSubjectValue(value: string): string {
    return value.replace(/[\r\n]+/g, " ").trim();
}

export function createNotificationEmailTemplate({
    recipientName,
    title,
    message,
    actionUrl,
}: NotificationEmailTemplateInput): RenderedEmail {
    const subject = sanitizeSubjectValue(title);
    const safeMessage = escapeHtml(message);

    const text = [
        `Hi ${recipientName},`,
        "",
        message,
        ...(actionUrl ? ["", `Open JobsSpot: ${actionUrl}`] : []),
        "",
        "You can change optional notification emails from your JobsSpot account settings.",
    ].join("\n");

    const html = renderEmailLayout({
        previewText: message,
        heading: title,
        headingStyle: "compact",
        greeting: `Hi ${recipientName},`,
        bodyHtml: `
            <p style="margin: 0">
                ${safeMessage}
            </p>
        `,
        ...(actionUrl
            ? {
                  actionLabel: "Open JobsSpot",
                  actionUrl,
              }
            : {}),
        footerNote:
            "You received this email because this notification category is enabled in your JobsSpot account settings.",
    });

    return { subject, html, text };
}
