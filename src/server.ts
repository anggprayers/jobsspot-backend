import app from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";

const server = app.listen(env.PORT, () => {
    console.log(`JobsSpot API running at http://localhost:${env.PORT}`);
});

let isShuttingDown = false;

async function shutdown(signal: string) {
    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;

    console.log(`${signal} received. Shutting down gracefully.`);

    server.close(async (error) => {
        if (error) {
            console.error("Failed to close the HTTP server:", error);
            process.exit(1);
        }

        try {
            await prisma.$disconnect();
            console.log("Database connection closed.");
            console.log("HTTP server closed.");

            process.exit(0);
        } catch (disconnectError) {
            console.error("Failed to close the database connection:", disconnectError);

            process.exit(1);
        }
    });
}

process.on("SIGINT", () => {
    void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
    void shutdown("SIGTERM");
});
