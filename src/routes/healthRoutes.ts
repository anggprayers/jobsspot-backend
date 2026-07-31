import { Router } from "express";

import { prisma } from "../lib/prisma.js";

const healthRouter = Router();

healthRouter.get("/", async (_request, response) => {
    try {
        await prisma.$queryRaw`SELECT 1`;

        response.status(200).json({
            success: true,
            message: "JobsSpot API and database are running.",
            database: "connected",
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error("Health check failed:", error);

        response.status(503).json({
            success: false,
            message: "JobsSpot API is running, but the database connection failed.",
            database: "disconnected",
            timestamp: new Date().toISOString(),
        });
    }
});

export default healthRouter;
