import { Router, type Request, type Response } from "express";

import { prisma } from "../lib/prisma.js";

const healthRouter = Router();

healthRouter.use((_request, response, next) => {
    response.set("Cache-Control", "no-store");
    next();
});

healthRouter.get("/live", (_request, response) => {
    response.status(200).json({
        success: true,
        message: "JobsSpot API is running.",
        service: "api",
        status: "live",
        timestamp: new Date().toISOString(),
    });
});

async function readinessCheck(_request: Request, response: Response) {
    try {
        await prisma.$queryRaw`SELECT 1`;

        response.status(200).json({
            success: true,
            message: "JobsSpot API and database are ready.",
            service: "api",
            status: "ready",
            database: "connected",
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Readiness check failed:", error);

        response.status(503).json({
            success: false,
            message: "JobsSpot API is running, but the database is not ready.",
            service: "api",
            status: "not_ready",
            database: "disconnected",
            timestamp: new Date().toISOString(),
        });
    }
}

// Backward-compatible health endpoint used by current deployment checks.
healthRouter.get("/", readinessCheck);
healthRouter.get("/ready", readinessCheck);

export default healthRouter;
