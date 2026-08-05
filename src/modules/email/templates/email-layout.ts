import { emailConfig } from "../email.config.js";

type EmailLayoutInput = {
    previewText: string;
    heading: string;
    greeting: string;
    bodyHtml: string;
    actionLabel: string;
    actionUrl: string;
    footerNote: string;
};

export function escapeHtml(value: string): string {
    return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function renderBrandLogo(): string {
    const logoCell = emailConfig.logoUrl
        ? `
            <td
                width="64"
                valign="middle"
                style="
                    width: 64px;
                    padding-right: 14px;
                "
            >
                <img
                    src="${escapeHtml(emailConfig.logoUrl)}"
                    width="58"
                    height="58"
                    alt="JobsSpot logo"
                    style="
                        display: block;
                        width: 58px;
                        height: 58px;
                        border: 0;
                        border-radius: 12px;
                        object-fit: contain;
                    "
                />
            </td>
        `
        : "";

    return `
        <table
            role="presentation"
            cellspacing="0"
            cellpadding="0"
            border="0"
        >
            <tr>
                ${logoCell}

                <td valign="middle">
                    <div
                        style="
                            color: #0f172a;
                            font-size: 25px;
                            font-weight: 800;
                            line-height: 1.1;
                            letter-spacing: -0.04em;
                        "
                    >
                        Jobs<span style="color: #2563eb">Spot</span>
                    </div>

                    <div
                        style="
                            margin-top: 5px;
                            color: #64748b;
                            font-size: 12px;
                            font-weight: 600;
                            line-height: 1.4;
                        "
                    >
                        Find work. Build teams.
                    </div>
                </td>
            </tr>
        </table>
    `;
}

export function renderEmailLayout({
    previewText,
    heading,
    greeting,
    bodyHtml,
    actionLabel,
    actionUrl,
    footerNote,
}: EmailLayoutInput): string {
    const safePreviewText = escapeHtml(previewText);
    const safeHeading = escapeHtml(heading);
    const safeGreeting = escapeHtml(greeting);
    const safeActionLabel = escapeHtml(actionLabel);
    const safeActionUrl = escapeHtml(actionUrl);
    const safeFooterNote = escapeHtml(footerNote);
    const safeReplyTo = escapeHtml(
        emailConfig.replyTo,
    );
    const brandLogo = renderBrandLogo();

    return `<!doctype html>
<html lang="en">
    <head>
        <meta charset="utf-8" />
        <meta
            name="viewport"
            content="width=device-width, initial-scale=1"
        />
        <title>${safeHeading}</title>
    </head>

    <body
        style="
            margin: 0;
            padding: 0;
            background-color: #edf4ff;
            color: #0f172a;
            font-family:
                Inter,
                Arial,
                Helvetica,
                sans-serif;
        "
    >
        <div
            style="
                display: none;
                max-height: 0;
                overflow: hidden;
                opacity: 0;
                color: transparent;
            "
        >
            ${safePreviewText}
        </div>

        <table
            role="presentation"
            width="100%"
            cellspacing="0"
            cellpadding="0"
            border="0"
            style="
                width: 100%;
                background-color: #edf4ff;
            "
        >
            <tr>
                <td
                    align="center"
                    style="padding: 36px 16px"
                >
                    <table
                        role="presentation"
                        width="100%"
                        cellspacing="0"
                        cellpadding="0"
                        border="0"
                        style="
                            width: 100%;
                            max-width: 620px;
                            overflow: hidden;
                            border: 1px solid #dbe6f5;
                            border-radius: 20px;
                            background-color: #ffffff;
                            box-shadow:
                                0 14px 34px
                                rgba(15, 23, 42, 0.09);
                        "
                    >
                        <tr>
                            <td
                                style="
                                    height: 6px;
                                    background-color: #2563eb;
                                    font-size: 0;
                                    line-height: 0;
                                "
                            >
                                &nbsp;
                            </td>
                        </tr>

                        <tr>
                            <td
                                style="
                                    border-bottom: 1px solid #e2e8f0;
                                    background-color: #ffffff;
                                    padding: 24px 32px;
                                "
                            >
                                ${brandLogo}
                            </td>
                        </tr>

                        <tr>
                            <td
                                style="padding: 36px 32px 38px"
                            >
                                <h1
                                    style="
                                        margin: 0;
                                        color: #0f172a;
                                        font-size: 30px;
                                        font-weight: 800;
                                        line-height: 1.25;
                                        letter-spacing: -0.04em;
                                    "
                                >
                                    ${safeHeading}
                                </h1>

                                <p
                                    style="
                                        margin: 24px 0 0;
                                        color: #334155;
                                        font-size: 16px;
                                        line-height: 1.75;
                                    "
                                >
                                    ${safeGreeting}
                                </p>

                                <div
                                    style="
                                        margin-top: 14px;
                                        color: #475569;
                                        font-size: 16px;
                                        line-height: 1.8;
                                    "
                                >
                                    ${bodyHtml}
                                </div>

                                <table
                                    role="presentation"
                                    cellspacing="0"
                                    cellpadding="0"
                                    border="0"
                                    style="margin-top: 30px"
                                >
                                    <tr>
                                        <td
                                            align="center"
                                            style="
                                                border-radius: 12px;
                                                background-color: #2563eb;
                                            "
                                        >
                                            <a
                                                href="${safeActionUrl}"
                                                style="
                                                    display: inline-block;
                                                    padding: 14px 24px;
                                                    color: #ffffff;
                                                    font-size: 16px;
                                                    font-weight: 700;
                                                    line-height: 1.25;
                                                    text-decoration: none;
                                                "
                                            >
                                                ${safeActionLabel}
                                            </a>
                                        </td>
                                    </tr>
                                </table>

                                <table
                                    role="presentation"
                                    width="100%"
                                    cellspacing="0"
                                    cellpadding="0"
                                    border="0"
                                    style="
                                        width: 100%;
                                        margin-top: 30px;
                                    "
                                >
                                    <tr>
                                        <td
                                            style="
                                                border-radius: 12px;
                                                background-color: #f8fafc;
                                                padding: 16px 18px;
                                            "
                                        >
                                            <p
                                                style="
                                                    margin: 0;
                                                    color: #64748b;
                                                    font-size: 13px;
                                                    line-height: 1.7;
                                                "
                                            >
                                                If the button does not work,
                                                copy and paste this address
                                                into your browser:
                                            </p>

                                            <p
                                                style="
                                                    margin: 8px 0 0;
                                                    word-break: break-all;
                                                    font-size: 13px;
                                                    line-height: 1.7;
                                                "
                                            >
                                                <a
                                                    href="${safeActionUrl}"
                                                    style="
                                                        color: #2563eb;
                                                        text-decoration: underline;
                                                    "
                                                >
                                                    ${safeActionUrl}
                                                </a>
                                            </p>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <tr>
                            <td
                                style="
                                    border-top: 1px solid #1e293b;
                                    background-color: #0f172a;
                                    padding: 26px 32px;
                                "
                            >
                                <p
                                    style="
                                        margin: 0;
                                        color: #cbd5e1;
                                        font-size: 13px;
                                        line-height: 1.7;
                                    "
                                >
                                    ${safeFooterNote}
                                </p>

                                <p
                                    style="
                                        margin: 14px 0 0;
                                        color: #94a3b8;
                                        font-size: 13px;
                                        line-height: 1.7;
                                    "
                                >
                                    JobsSpot connects job seekers with
                                    growing employers.
                                </p>

                                <p
                                    style="
                                        margin: 8px 0 0;
                                        color: #94a3b8;
                                        font-size: 13px;
                                        line-height: 1.7;
                                    "
                                >
                                    Questions? Reply to this email or
                                    contact
                                    <a
                                        href="mailto:${safeReplyTo}"
                                        style="
                                            color: #93c5fd;
                                            text-decoration: none;
                                        "
                                    >
                                        ${safeReplyTo}
                                    </a>.
                                </p>

                                <p
                                    style="
                                        margin: 12px 0 0;
                                        color: #64748b;
                                        font-size: 12px;
                                        line-height: 1.7;
                                    "
                                >
                                    © ${new Date().getFullYear()}
                                    JobsSpot. All rights reserved.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
</html>`;
}
