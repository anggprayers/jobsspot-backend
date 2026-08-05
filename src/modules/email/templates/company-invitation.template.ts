import type { CompanyMemberRole } from "../../../generated/prisma/client.js";

import { emailConfig } from "../email.config.js";
import type { RenderedEmail } from "../email.types.js";
import { escapeHtml, renderEmailLayout } from "./email-layout.js";

type CompanyInvitationTemplateInput = {
    recipientName: string;
    inviterName: string;
    companyName: string;
    role: CompanyMemberRole;
    actionUrl: string;
};

function formatRole(role: CompanyMemberRole): string {
    const labels: Record<CompanyMemberRole, string> = {
        OWNER: "Owner",
        ADMIN: "Admin",
        RECRUITER: "Recruiter",
        VIEWER: "Viewer",
    };

    return labels[role];
}

function sanitizeSubjectValue(value: string): string {
    return value.replace(/[\r\n]+/g, " ").trim();
}

export function createCompanyInvitationTemplate({
    recipientName,
    inviterName,
    companyName,
    role,
    actionUrl,
}: CompanyInvitationTemplateInput): RenderedEmail {
    const roleLabel = formatRole(role);
    const subjectCompanyName = sanitizeSubjectValue(companyName);
    const safeInviterName = escapeHtml(inviterName);
    const safeCompanyName = escapeHtml(companyName);
    const safeRoleLabel = escapeHtml(roleLabel);

    const subject = `You are invited to join ${subjectCompanyName} on JobsSpot`;

    const text = [
        `Hi ${recipientName},`,
        "",
        `${inviterName} invited you to join ${companyName} on JobsSpot as ${roleLabel}.`,
        "",
        `Accept invitation: ${actionUrl}`,
        "",
        `This single-use invitation expires in ${emailConfig.companyInvitationTokenTtlDays} days.`,
        "Sign in or create your JobsSpot account using this email address to join the company.",
        "If you were not expecting this invitation, you can ignore this email.",
    ].join("\n");

    const html = renderEmailLayout({
        previewText: `${inviterName} invited you to join ${companyName} on JobsSpot.`,
        heading: "You’ve been invited",
        headingStyle: "compact",
        greeting: `Hi ${recipientName},`,
        bodyHtml: `
            <p style="margin: 0">
                <span style="font-weight: 600">${safeInviterName}</span>
                invited you to join
                <span style="font-weight: 600">${safeCompanyName}</span>
                on JobsSpot.
            </p>

            <p style="margin: 14px 0 0">
                You’ll join the company workspace with the
                <span style="font-weight: 600">${safeRoleLabel}</span>
                role. Sign in or create your JobsSpot account using
                this email address to continue.
            </p>

            <p style="margin: 14px 0 0; color: #475569">
                This single-use invitation expires in
                ${emailConfig.companyInvitationTokenTtlDays} days.
            </p>
        `,
        actionLabel: "Accept invitation",
        actionUrl,
        footerNote:
            "You received this message because a JobsSpot employer invited this email address to a company workspace. Ignore it if you were not expecting the invitation.",
    });

    return {
        subject,
        html,
        text,
    };
}
