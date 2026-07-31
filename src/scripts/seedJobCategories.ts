import { prisma } from "../lib/prisma.js";
import { createSlug } from "../utils/slug.js";

const categories = [
    "Software Engineering",
    "Data Science",
    "Product Management",
    "Design",
    "Marketing",
    "Sales",
    "Finance",
    "Accounting",
    "Human Resources",
    "Customer Support",
    "Healthcare",
    "Education",
    "Legal",
    "Operations",
    "Construction",
];

async function main() {
    for (const name of categories) {
        await prisma.jobCategory.upsert({
            where: {
                slug: createSlug(name),
            },
            update: {},
            create: {
                name,
                slug: createSlug(name),
            },
        });
    }

    console.log("✅ Job categories seeded.");
}

main()
    .catch((error) => {
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
