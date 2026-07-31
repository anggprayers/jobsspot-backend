import { CompanyMemberRole } from "../generated/prisma/client.js";

import { prisma } from "../lib/prisma.js";

async function main(): Promise<void> {
    const user = await prisma.user.findUnique({
        where: {
            email: "angelo@example.com",
        },
        select: {
            id: true,
            email: true,
        },
    });

    if (!user) {
        throw new Error("User not found.");
    }

    const company = await prisma.company.upsert({
        where: {
            slug: "jobsspot-test-company",
        },
        update: {},
        create: {
            name: "JobsSpot Test Company",
            slug: "jobsspot-test-company",
            description: "Temporary company for authorization testing.",
            location: "Philippines",
        },
        select: {
            id: true,
            name: true,
            slug: true,
        },
    });

    const membership = await prisma.companyMembership.upsert({
        where: {
            companyId_userId: {
                companyId: company.id,
                userId: user.id,
            },
        },
        update: {
            role: CompanyMemberRole.OWNER,
            deletedAt: null,
        },
        create: {
            companyId: company.id,
            userId: user.id,
            role: CompanyMemberRole.OWNER,
        },
        select: {
            id: true,
            companyId: true,
            userId: true,
            role: true,
        },
    });

    console.log({
        company,
        membership,
    });
}

main()
    .catch((error: unknown) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
