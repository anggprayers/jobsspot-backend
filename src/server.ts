import app from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./lib/prisma.js";

const server = app.listen(env.PORT, "0.0.0.0", () => {
    console.log(`JobsSpot API listening on port ${env.PORT}.`);
});

// Keep proxy connections stable during normal Render traffic and deploys.
server.keepAliveTimeout = 120_000;
server.headersTimeout = 125_000;

let isShuttingDown = false;

async function shutdown(signal: string) {
    if (isShuttingDown) {
        return;
    }

    isShuttingDown = true;

    console.log(`${signal} received. Shutting down gracefully.`);

    const forceShutdownTimer = setTimeout(() => {
        console.error("Graceful shutdown timed out. Forcing process exit.");
        process.exit(1);
    }, 10_000);
    forceShutdownTimer.unref();

    server.close(async (error) => {
        if (error) {
            console.error("Failed to close the HTTP server:", error);
            process.exit(1);
        }

        try {
            await prisma.$disconnect();
            clearTimeout(forceShutdownTimer);
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
