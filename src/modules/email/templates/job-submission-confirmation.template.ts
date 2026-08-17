import { emailConfig } from "../email.config.js";
import type { RenderedEmail } from "../email.types.js";
import {
    escapeHtml,
    renderEmailLayout,
} from "./email-layout.js";

type JobSubmissionConfirmationTemplateInput = {
    referenceCode: string;
    jobTitle: string;
    companyName: string;
    contactName: string | null;
};

export function createJobSubmissionConfirmationTemplate({
    referenceCode,
    jobTitle,
    companyName,
    contactName,
}: JobSubmissionConfirmationTemplateInput): RenderedEmail {
    const safeReferenceCode = escapeHtml(referenceCode);
    const safeJobTitle = escapeHtml(jobTitle);
    const safeCompanyName = escapeHtml(companyName);
    const greetingName = contactName?.trim() || "there";

    const text = [
        `Hi ${greetingName},`,
        "",
        "JobsSpot received your job submission.",
        "",
        `Reference: ${referenceCode}`,
        `Job: ${jobTitle}`,
        `Company: ${companyName}`,
        "",
        "Our team will review the details and may contact you if anything needs clarification before publication.",
        "",
        "Submitting a job does not mean it is published yet. JobsSpot will review it first.",
        "",
        "You can reply to this email if you need to add information to your submission.",
    ].join("\n");

    const html = renderEmailLayout({
        previewText: `JobsSpot received ${jobTitle} for review.`,
        heading: "We received your job submission",
        headingStyle: "compact",
        greeting: `Hi ${greetingName},`,
        bodyHtml: `
            <p style="margin: 0">
                Thanks for submitting a job to JobsSpot. Our team will review
                the details and may contact you if anything needs clarification
                before publication.
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
                    <td style="padding: 14px 16px 6px; color: #0f172a; font-size: 13px; font-weight: 700">${safeReferenceCode}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 16px; color: #64748b; font-size: 13px">Job</td>
                    <td style="padding: 6px 16px; color: #0f172a; font-size: 13px; font-weight: 700">${safeJobTitle}</td>
                </tr>
                <tr>
                    <td style="padding: 6px 16px 14px; color: #64748b; font-size: 13px">Company</td>
                    <td style="padding: 6px 16px 14px; color: #0f172a; font-size: 13px; font-weight: 700">${safeCompanyName}</td>
                </tr>
            </table>

            <p style="margin: 20px 0 0; color: #64748b">
                This submission is pending JobsSpot review and is not published yet.
                Reply to this email if you need to add information.
            </p>
        `,
        actionLabel: "Visit JobsSpot",
        actionUrl: emailConfig.frontendUrl,
        footerNote:
            "This confirmation was sent because a job submission was made using this email address.",
    });

    return {
        subject: `JobsSpot received your job submission — ${referenceCode}`,
        html,
        text,
    };
}
