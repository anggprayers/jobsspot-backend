import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env.js";
import { errorHandler } from "./errors/errorHandler.js";
import { apiRateLimiter } from "./middleware/rateLimit.js";
import authRouter from "./modules/auth/auth.routes.js";
import companyRouter from "./modules/company/company.routes.js";
import { publicJobRouter } from "./modules/public-job/public-job.routes.js";
import publicJobCategoryRouter from "./modules/public-job-category/public-job-category.routes.js";
import healthRouter from "./routes/healthRoutes.js";

const app = express();

app.disable("x-powered-by");

app.use(helmet());

app.use(
    cors({
        origin: env.FRONTEND_URL,
        credentials: true,
    }),
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use("/api/health", healthRouter);

app.use("/api", apiRateLimiter);

app.use("/api/auth", authRouter);

app.use("/api/companies", companyRouter);

app.use("/api/jobs", publicJobRouter);

app.use("/api/job-categories", publicJobCategoryRouter);

app.use((_request, response) => {
    response.status(404).json({
        success: false,
        message: "API route not found.",
    });
});

app.use(errorHandler);

export default app;
