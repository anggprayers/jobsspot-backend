import type { RenderedEmail } from "../email.types.js";
import { escapeHtml, renderEmailLayout } from "./email-layout.js";

type SavedSearchAlertJob = {
    title: string;
    companyName: string;
    location: string | null;
    employmentType: string;
    workplaceType: string;
    salaryMin: number | null;
    salaryMax: number | null;
    salaryCurrency: string | null;
    salaryPeriod: string | null;
    url: string;
};

type SavedSearchAlertTemplateInput = {
    recipientName: string;
    savedSearchName: string;
    frequency: "DAILY" | "WEEKLY";
    totalMatches: number;
    jobs: SavedSearchAlertJob[];
    searchUrl: string;
    manageAlertsUrl: string;
};

function humanizeEnum(value: string): string {
    const specialLabels: Record<string, string> = {
        ONSITE: "On-site",
        FULL_TIME: "Full Time",
        PART_TIME: "Part Time",
        ENTRY_LEVEL: "Entry Level",
        MID_LEVEL: "Mid Level",
    };

    return (
        specialLabels[value] ??
        value
            .toLowerCase()
            .split("_")
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(" ")
    );
}

function formatSalary(job: SavedSearchAlertJob): string | null {
    if (!job.salaryPeriod || (!job.salaryMin && !job.salaryMax)) {
        return null;
    }

    const currency = job.salaryCurrency ?? "USD";
    const formatter = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
    });

    const period = humanizeEnum(job.salaryPeriod).toLowerCase();

    if (job.salaryMin !== null && job.salaryMax !== null) {
        return `${formatter.format(job.salaryMin)} - ${formatter.format(job.salaryMax)} / ${period}`;
    }

    if (job.salaryMin !== null) {
        return `From ${formatter.format(job.salaryMin)} / ${period}`;
    }

    return `Up to ${formatter.format(job.salaryMax ?? 0)} / ${period}`;
}

function renderJobCard(job: SavedSearchAlertJob): string {
    const safeTitle = escapeHtml(job.title);
    const safeCompany = escapeHtml(job.companyName);
    const safeUrl = escapeHtml(job.url);
    const detailParts = [
        job.location,
        humanizeEnum(job.employmentType),
        humanizeEnum(job.workplaceType),
    ].filter((value): value is string => Boolean(value));
    const salary = formatSalary(job);

    return `
        <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
                width: 100%;
                margin-top: 14px;
                border: 1px solid #dbe6f5;
                border-radius: 14px;
                background-color: #ffffff;
            "
        >
            <tr>
                <td style="padding: 18px 20px">
                    <p style="margin: 0; font-size: 17px; font-weight: 800; line-height: 1.35">
                        <a href="${safeUrl}" style="color: #0f172a; text-decoration: underline">
                            ${safeTitle}
                        </a>
                    </p>
                    <p style="margin: 6px 0 0; color: #475569; font-size: 14px; line-height: 1.5">
                        ${safeCompany}
                    </p>
                    <p style="margin: 9px 0 0; color: #64748b; font-size: 13px; line-height: 1.55">
                        ${detailParts.map(escapeHtml).join(" &middot; ")}
                    </p>
                    ${
                        salary
                            ? `<p style="margin: 7px 0 0; color: #334155; font-size: 13px; font-weight: 700; line-height: 1.5">${escapeHtml(salary)}</p>`
                            : ""
                    }
                </td>
            </tr>
        </table>
    `;
}

export function createSavedSearchAlertEmailTemplate({
    recipientName,
    savedSearchName,
    frequency,
    totalMatches,
    jobs,
    searchUrl,
    manageAlertsUrl,
}: SavedSearchAlertTemplateInput): RenderedEmail {
    const subject = `${totalMatches} new ${totalMatches === 1 ? "job" : "jobs"} for ${savedSearchName}`;
    const frequencyLabel = frequency === "DAILY" ? "daily" : "weekly";
    const shownCount = jobs.length;

    const bodyHtml = `
        <p style="margin: 0; color: #334155; font-size: 16px; line-height: 1.75">
            Based on your saved search for <strong>${escapeHtml(savedSearchName)}</strong>,
            we found <strong>${totalMatches} new ${totalMatches === 1 ? "job" : "jobs"}</strong>
            that could be right for you.
        </p>

        ${jobs.map(renderJobCard).join("")}

        ${
            totalMatches > shownCount
                ? `<p style="margin: 18px 0 0; color: #64748b; font-size: 13px; line-height: 1.6">Showing ${shownCount} of ${totalMatches} new matches. Open JobsSpot to see the rest.</p>`
                : ""
        }

        <p style="margin: 24px 0 0; color: #64748b; font-size: 13px; line-height: 1.7">
            This is your ${frequencyLabel} JobsSpot alert. You can change the frequency or turn alerts off from
            <a href="${escapeHtml(manageAlertsUrl)}" style="color: #2563eb; text-decoration: underline">Saved searches</a>.
        </p>
    `;

    const textJobs = jobs.flatMap((job) => [
        `- ${job.title}`,
        `  ${job.companyName}`,
        ...(job.location ? [`  ${job.location}`] : []),
        `  ${job.url}`,
    ]);

    const text = [
        `Hi ${recipientName},`,
        "",
        `Based on your saved search for ${savedSearchName}, we found ${totalMatches} new ${totalMatches === 1 ? "job" : "jobs"} that could be right for you.`,
        "",
        ...textJobs,
        "",
        `View all matching jobs: ${searchUrl}`,
        `Manage alerts: ${manageAlertsUrl}`,
    ].join("\n");

    const html = renderEmailLayout({
        previewText: `${totalMatches} new job matches for ${savedSearchName}`,
        heading: subject,
        headingStyle: "compact",
        greeting: `Hi ${recipientName},`,
        bodyHtml,
        actionLabel: "View matching jobs",
        actionUrl: searchUrl,
        footerNote:
            "You received this email because job alerts are enabled for this saved search.",
    });

    return { subject, html, text };
}
