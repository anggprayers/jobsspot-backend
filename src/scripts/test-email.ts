import "dotenv/config";

import { randomUUID } from "node:crypto";

import { z } from "zod";

const recipientSchema = z.email(
    "Provide a valid recipient email address.",
);

async function main() {
    const recipientResult =
        recipientSchema.safeParse(process.argv[2]);

    if (!recipientResult.success) {
        console.error(
            "Usage: npx tsx src/scripts/test-email.ts recipient@example.com",
        );

        process.exitCode = 1;
        return;
    }

    const recipient = recipientResult.data;

    const [
        { sendTransactionalEmail },
        { renderEmailLayout },
    ] = await Promise.all([
        import("../modules/email/email.service.js"),
        import(
            "../modules/email/templates/email-layout.js"
        ),
    ]);

    const subject =
        "JobsSpot email foundation is working";

    const actionUrl =
        process.env.FRONTEND_URL ??
        "http://localhost:3000";

    const html = renderEmailLayout({
        previewText:
            "JobsSpot successfully connected to Resend.",
        heading: "Email delivery is ready",
        greeting: "Hello,",
        bodyHtml: `
            <p style="margin: 0">
                JobsSpot successfully connected to the verified
                Resend sending domain.
            </p>
            <p style="margin: 14px 0 0">
                The shared transactional email foundation is ready
                for email verification, password resets, contact
                delivery, job alerts, and other notifications.
            </p>
        `,
        actionLabel: "Open JobsSpot",
        actionUrl,
        footerNote:
            "This is a one-time delivery test requested by the JobsSpot development team.",
    });

    const text = [
        "JobsSpot email delivery is ready.",
        "",
        "The backend successfully connected to Resend.",
        "",
        `Open JobsSpot: ${actionUrl}`,
    ].join("\n");

    const result =
        await sendTransactionalEmail({
            to: recipient,
            subject,
            html,
            text,
            idempotencyKey: `email-foundation-test/${randomUUID()}`,
        });

    console.log(
        "JobsSpot test email sent successfully.",
    );
    console.log(`Email ID: ${result.emailId}`);
    console.log(`Recipient: ${recipient}`);
}

main().catch((error: unknown) => {
    console.error(
        "JobsSpot email test failed.",
        error,
    );

    process.exitCode = 1;
});
