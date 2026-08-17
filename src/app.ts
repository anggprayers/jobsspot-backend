import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";

import { env } from "./config/env.js";
import { errorHandler } from "./errors/errorHandler.js";
import { apiRateLimiter } from "./middleware/rateLimit.js";
import authRouter from "./modules/auth/auth.routes.js";
import companyRouter from "./modules/company/company.routes.js";
import companyInvitationAcceptanceRouter from "./modules/company-invitations/company-invitation-acceptance.routes.js";
import contactRouter from "./modules/contact/contact.routes.js";
import jobSubmissionRouter from "./modules/job-submission/job-submission.routes.js";
import jobSeekerApplicationRouter from "./modules/job-seeker-application/job-seeker-application.routes.js";
import jobSeekerProfileRouter from "./modules/job-seeker-profile/job-seeker-profile.routes.js";
import jobReportRouter from "./modules/job-report/job-report.routes.js";
import notificationRouter from "./modules/notification/notification.routes.js";
import { publicJobRouter } from "./modules/public-job/public-job.routes.js";
import popularSearchRouter from "./modules/popular-search/popular-search.routes.js";
import platformAdminRouter from "./modules/platform-admin/platform-admin.routes.js";
import publicJobCategoryRouter from "./modules/public-job-category/public-job-category.routes.js";
import resumeRouter from "./modules/resume/resume.routes.js";
import savedJobRouter from "./modules/saved-job/saved-job.routes.js";
import savedSearchRouter from "./modules/saved-search/saved-search.routes.js";
import healthRouter from "./routes/healthRoutes.js";
import internalMaintenanceRouter from "./modules/internal-maintenance/internal-maintenance.routes.js";

const app = express();

if (env.NODE_ENV === "production" && env.TRUST_PROXY_HOPS > 0) {
    app.set("trust proxy", env.TRUST_PROXY_HOPS);
}

app.disable("x-powered-by");

app.use(helmet());

app.use(
    cors({
        origin: env.CORS_ALLOWED_ORIGINS,
        credentials: true,
        maxAge: 24 * 60 * 60,
    }),
);

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());

app.use("/api/health", healthRouter);

app.use("/api", apiRateLimiter);

app.use("/api/internal", internalMaintenanceRouter);

app.use("/api/auth", authRouter);

app.use("/api/admin", platformAdminRouter);

app.use("/api/contact", contactRouter);

app.use("/api/job-submissions", jobSubmissionRouter);

app.use("/api/job-seeker-profile", jobSeekerProfileRouter);

app.use("/api/resumes", resumeRouter);

app.use("/api/applications", jobSeekerApplicationRouter);

app.use("/api/job-reports", jobReportRouter);

app.use("/api/notifications", notificationRouter);

app.use("/api/saved-jobs", savedJobRouter);

app.use("/api/saved-searches", savedSearchRouter);

app.use("/api/company-invitations", companyInvitationAcceptanceRouter);

app.use("/api/companies", companyRouter);

app.use("/api/jobs", publicJobRouter);

app.use("/api/popular-searches", popularSearchRouter);

app.use("/api/job-categories", publicJobCategoryRouter);

app.use((_request, response) => {
    response.status(404).json({
        success: false,
        message: "API route not found.",
    });
});

app.use(errorHandler);

export default app;
