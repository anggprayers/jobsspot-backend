import type {
    EmploymentType,
    WorkplaceType,
} from "../../../generated/prisma/client.js";

import type { RenderedEmail } from "../email.types.js";
import {
    escapeHtml,
    renderEmailLayout,
} from "./email-layout.js";

import { formatJobsSpotDateTime } from "../../../utils/jobs-spot-time.js";

const workplaceLabels: Record<WorkplaceType, string> = {
    ONSITE: "On-site",
    REMOTE: "Remote",
    HYBRID: "Hybrid",
};

const employmentLabels: Record<EmploymentType, string> = {
    FULL_TIME: "Full-time",
    PART_TIME: "Part-time",
    CONTRACT: "Contract",
    TEMPORARY: "Temporary",
    INTERNSHIP: "Internship",
};

type JobSubmissionNotificationTemplateInput = {
    referenceCode: string;
    receivedAt: Date;
    jobTitle: string;
    companyName: string;
    companyWebsite: string | null;
    locationText: string;
    workplaceType: WorkplaceType;
    employmentType: EmploymentType;
    salaryText: string | null;
    description: string;
    contactName: string | null;
    contactEmail: string;
    contactPhone: string | null;
    ipAddress: string | null;
    userAgent: string | null;
};

function renderMultilineText(value: string): string {
    return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

export function createJobSubmissionNotificationTemplate({
    referenceCode,
    receivedAt,
    jobTitle,
    companyName,
    companyWebsite,
    locationText,
    workplaceType,
    employmentType,
    salaryText,
    description,
    contactName,
    contactEmail,
    contactPhone,
    ipAddress,
    userAgent,
}: JobSubmissionNotificationTemplateInput): RenderedEmail {
    const safeReferenceCode = escapeHtml(referenceCode);
    const safeJobTitle = escapeHtml(jobTitle);
    const safeCompanyName = escapeHtml(companyName);
    const safeCompanyWebsite = escapeHtml(companyWebsite ?? "Not provided");
    const safeLocation = escapeHtml(locationText);
    const safeWorkplace = escapeHtml(workplaceLabels[workplaceType]);
    const safeEmployment = escapeHtml(employmentLabels[employmentType]);
    const safeSalary = escapeHtml(salaryText ?? "Not provided");
    const safeDescription = renderMultilineText(description);
    const safeContactName = escapeHtml(contactName ?? "Not provided");
    const safeContactEmail = escapeHtml(contactEmail);
    const safeContactPhone = escapeHtml(contactPhone ?? "Not provided");
    const safeReceivedAt = escapeHtml(formatJobsSpotDateTime(receivedAt));
    const safeIpAddress = escapeHtml(ipAddress ?? "Unavailable");
    const safeUserAgent = escapeHtml(userAgent ?? "Unavailable");

    const text = [
        "New JobsSpot job submission",
        "",
        `Reference: ${referenceCode}`,
        `Received: ${formatJobsSpotDateTime(receivedAt)}`,
        `Job: ${jobTitle}`,
        `Company: ${companyName}`,
        `Company website: ${companyWebsite ?? "Not provided"}`,
        `Location: ${locationText}`,
        `Work arrangement: ${workplaceLabels[workplaceType]}`,
        `Job type: ${employmentLabels[employmentType]}`,
        `Salary/pay rate: ${salaryText ?? "Not provided"}`,
        "",
        "Description:",
        description,
        "",
        `Contact name: ${contactName ?? "Not provided"}`,
        `Contact email: ${contactEmail}`,
        `Contact phone: ${contactPhone ?? "Not provided"}`,
        "",
        `IP address: ${ipAddress ?? "Unavailable"}`,
        `User agent: ${userAgent ?? "Unavailable"}`,
    ].join("\n");

    const html = renderEmailLayout({
        previewText: `${companyName} submitted ${jobTitle} for JobsSpot review.`,
        heading: "New job submission",
        headingStyle: "compact",
        greeting: "A new job was submitted to JobsSpot for review.",
        bodyHtml: `
            <table
                role="presentation"
                width="100%"
                cellspacing="0"
                cellpadding="0"
                border="0"
                style="width: 100%; border-collapse: collapse"
            >
                <tr><td style="padding: 7px 0; color: #64748b; width: 150px">Reference</td><td style="padding: 7px 0; color: #0f172a; font-weight: 600">${safeReferenceCode}</td></tr>
                <tr><td style="padding: 7px 0; color: #64748b">Received</td><td style="padding: 7px 0; color: #0f172a; font-weight: 600">${safeReceivedAt}</td></tr>
                <tr><td style="padding: 7px 0; color: #64748b">Job</td><td style="padding: 7px 0; color: #0f172a; font-weight: 600">${safeJobTitle}</td></tr>
                <tr><td style="padding: 7px 0; color: #64748b">Company</td><td style="padding: 7px 0; color: #0f172a; font-weight: 600">${safeCompanyName}</td></tr>
                <tr><td style="padding: 7px 0; color: #64748b">Website</td><td style="padding: 7px 0; color: #0f172a; font-weight: 600">${safeCompanyWebsite}</td></tr>
                <tr><td style="padding: 7px 0; color: #64748b">Location</td><td style="padding: 7px 0; color: #0f172a; font-weight: 600">${safeLocation}</td></tr>
                <tr><td style="padding: 7px 0; color: #64748b">Work arrangement</td><td style="padding: 7px 0; color: #0f172a; font-weight: 600">${safeWorkplace}</td></tr>
                <tr><td style="padding: 7px 0; color: #64748b">Job type</td><td style="padding: 7px 0; color: #0f172a; font-weight: 600">${safeEmployment}</td></tr>
                <tr><td style="padding: 7px 0; color: #64748b">Salary/pay rate</td><td style="padding: 7px 0; color: #0f172a; font-weight: 600">${safeSalary}</td></tr>
                <tr><td style="padding: 7px 0; color: #64748b">Contact</td><td style="padding: 7px 0; color: #0f172a; font-weight: 600">${safeContactName}<br />${safeContactEmail}<br />${safeContactPhone}</td></tr>
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
                ${safeDescription}
            </div>

            <p style="margin: 20px 0 0; color: #64748b; font-size: 13px">
                Submission metadata — IP: ${safeIpAddress}; User agent: ${safeUserAgent}
            </p>
        `,
        footerNote:
            "This job is pending review and has not been published automatically.",
    });

    return {
        subject: `New job submission: ${jobTitle} — ${referenceCode}`,
        html,
        text,
    };
}
