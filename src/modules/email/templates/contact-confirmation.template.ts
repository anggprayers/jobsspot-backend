import { emailConfig } from "../email.config.js";
import type { RenderedEmail } from "../email.types.js";
import {
    escapeHtml,
    renderEmailLayout,
} from "./email-layout.js";

const inquiryTypeLabels = {
    GENERAL: "General inquiry",
    JOB_SEEKER: "Job seeker support",
    EMPLOYER: "Employer support",
    PARTNERSHIP: "Partnership",
    TECHNICAL_SUPPORT: "Technical support",
    FEEDBACK: "Feedback",
} as const;

type ContactInquiryType = keyof typeof inquiryTypeLabels;

type ContactConfirmationTemplateInput = {
    referenceId: string;
    name: string;
    subject: string;
    inquiryType: ContactInquiryType;
};

export function createContactConfirmationTemplate({
    referenceId,
    name,
    subject,
    inquiryType,
}: ContactConfirmationTemplateInput): RenderedEmail {
    const inquiryLabel = inquiryTypeLabels[inquiryType];
    const safeReferenceId = escapeHtml(referenceId);
    const safeSubject = escapeHtml(subject);
    const safeInquiryLabel = escapeHtml(inquiryLabel);

    const text = [
        `Hi ${name},`,
        "",
        "Thanks for contacting JobsSpot. We received your message and will reply as soon as possible.",
        "",
        `Reference: ${referenceId}`,
        `Inquiry type: ${inquiryLabel}`,
        `Subject: ${subject}`,
        "",
        "You can reply to this email if you need to add more information.",
    ].join("\n");

    const html = renderEmailLayout({
        previewText: "JobsSpot received your message.",
        heading: "We received your message",
        headingStyle: "compact",
        greeting: `Hi ${name},`,
        bodyHtml: `
            <p style="margin: 0">
                Thanks for contacting JobsSpot. Your message reached our team,
                and we’ll reply as soon as possible.
            </p>

            <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
                style="
                    width: 100%;
                    margin-top: 22px;
                    border-collapse: collapse;
                    border-radius: 12px;
                    background-color: #f8fafc;
                "
            >
                <tr>
                    <td style="padding: 14px 16px 6px; color: #64748b; font-size: 13px">Reference</td>
                    <td style="padding: 14px 16px 6px; color: #0f172a; font-size: 13px; font-weight: 700">${safeReferenceId}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 16px; color: #64748b; font-size: 13px">Inquiry</td>
                    <td style="padding: 6px 16px; color: #0f172a; font-size: 13px; font-weight: 700">${safeInquiryLabel}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 16px 14px; color: #64748b; font-size: 13px">Subject</td>
                    <td style="padding: 6px 16px 14px; color: #0f172a; font-size: 13px; font-weight: 700">${safeSubject}</td>
                </tr>
            </table>

            <p style="margin: 20px 0 0; color: #64748b">
                Reply to this email if you need to add more information to your request.
            </p>
        `,
        actionLabel: "Visit JobsSpot",
        actionUrl: emailConfig.frontendUrl,
        footerNote:
            "This confirmation was sent because a contact request was submitted using this email address.",
    });

    return {
        subject: "We received your JobsSpot message",
        html,
        text,
    };
}
