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

type ContactNotificationTemplateInput = {
    referenceId: string;
    receivedAt: Date;
    name: string;
    email: string;
    inquiryType: ContactInquiryType;
    subject: string;
    message: string;
    ipAddress: string | null;
    userAgent: string | null;
};

function sanitizeSubjectValue(value: string): string {
    return value.replace(/[\r\n]+/g, " ").trim();
}

function renderMultilineText(value: string): string {
    return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

export function createContactNotificationTemplate({
    referenceId,
    receivedAt,
    name,
    email,
    inquiryType,
    subject,
    message,
    ipAddress,
    userAgent,
}: ContactNotificationTemplateInput): RenderedEmail {
    const inquiryLabel = inquiryTypeLabels[inquiryType];
    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeInquiryLabel = escapeHtml(inquiryLabel);
    const safeSubject = escapeHtml(subject);
    const safeMessage = renderMultilineText(message);
    const safeReferenceId = escapeHtml(referenceId);
    const safeReceivedAt = escapeHtml(receivedAt.toISOString());
    const safeIpAddress = escapeHtml(ipAddress ?? "Unavailable");
    const safeUserAgent = escapeHtml(userAgent ?? "Unavailable");
    const emailSubject = sanitizeSubjectValue(subject);

    const text = [
        "New JobsSpot contact request",
        "",
        `Reference: ${referenceId}`,
        `Received: ${receivedAt.toISOString()}`,
        `Name: ${name}`,
        `Email: ${email}`,
        `Inquiry type: ${inquiryLabel}`,
        `Subject: ${subject}`,
        "",
        "Message:",
        message,
        "",
        `IP address: ${ipAddress ?? "Unavailable"}`,
        `User agent: ${userAgent ?? "Unavailable"}`,
    ].join("\n");

    const html = renderEmailLayout({
        previewText: `${name} sent a ${inquiryLabel.toLowerCase()} through JobsSpot.`,
        heading: "New contact request",
        headingStyle: "compact",
        greeting: "A new message was submitted through the JobsSpot contact form.",
        bodyHtml: `
            <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
                style="width: 100%; border-collapse: collapse"
            >
                <tr>
                    <td style="padding: 8px 0; color: #64748b; width: 130px">Reference</td>
                    <td style="padding: 8px 0; color: #0f172a; font-weight: 600">${safeReferenceId}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b">Name</td>
                    <td style="padding: 8px 0; color: #0f172a; font-weight: 600">${safeName}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b">Email</td>
                    <td style="padding: 8px 0; color: #0f172a; font-weight: 600">${safeEmail}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b">Inquiry</td>
                    <td style="padding: 8px 0; color: #0f172a; font-weight: 600">${safeInquiryLabel}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; color: #64748b">Subject</td>
                    <td style="padding: 8px 0; color: #0f172a; font-weight: 600">${safeSubject}</td>
                </tr>
            </table>

            <div
                style="
                    margin-top: 22px;
                    border-left: 4px solid #2563eb;
                    border-radius: 8px;
                    background-color: #f8fafc;
                    padding: 18px;
                    color: #334155;
                    line-height: 1.75;
                "
            >
                ${safeMessage}
            </div>

            <p style="margin: 22px 0 0; color: #64748b; font-size: 13px; line-height: 1.7">
                Received ${safeReceivedAt}<br />
                IP: ${safeIpAddress}<br />
                User agent: ${safeUserAgent}
            </p>
        `,
        footerNote:
            "Reply directly to this email to respond to the sender. Verify sensitive requests before taking account or billing actions.",
    });

    return {
        subject: `[JobsSpot Contact] ${emailSubject}`,
        html,
        text,
    };
}
