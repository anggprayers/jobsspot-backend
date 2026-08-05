import {
    JobStatus,
} from "../generated/prisma/client.js";

import { prisma } from "../lib/prisma.js";

const JOB_POST_DURATION_DAYS = 30;
const MILLISECONDS_PER_DAY =
    24 * 60 * 60 * 1000;

function calculateExpiration({
    publishedAt,
    applicationDeadline,
}: {
    publishedAt: Date;
    applicationDeadline: Date | null;
}): Date {
    const defaultExpiration = new Date(
        publishedAt.getTime() +
            JOB_POST_DURATION_DAYS *
                MILLISECONDS_PER_DAY,
    );

    if (
        applicationDeadline &&
        applicationDeadline < defaultExpiration
    ) {
        return applicationDeadline;
    }

    return defaultExpiration;
}

async function main() {
    const jobs =
        await prisma.job.findMany({
            where: {
                status: JobStatus.PUBLISHED,
                deletedAt: null,
                expiresAt: null,
            },
            select: {
                id: true,
                title: true,
                publishedAt: true,
                updatedAt: true,
                applicationDeadline: true,
            },
            orderBy: {
                createdAt: "asc",
            },
        });

    let updatedCount = 0;

    for (const job of jobs) {
        const publishedAt =
            job.publishedAt ?? job.updatedAt;

        const expiresAt =
            calculateExpiration({
                publishedAt,
                applicationDeadline:
                    job.applicationDeadline,
            });

        await prisma.job.update({
            where: {
                id: job.id,
            },
            data: {
                publishedAt,
                expiresAt,
            },
        });

        updatedCount += 1;

        console.log(
            `Updated ${job.title}: ${expiresAt.toISOString()}`,
        );
    }

    console.log(
        `Backfill complete. ${updatedCount} published job(s) updated.`,
    );
}

main()
    .catch((error: unknown) => {
        console.error(
            "Unable to backfill job expiration dates.",
            error,
        );
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
