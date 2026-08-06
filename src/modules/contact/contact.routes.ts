import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { contactRateLimiter } from "../../middleware/rateLimit.js";
import { validate } from "../../middleware/validate.js";

import { submitContactMessageController } from "./contact.controller.js";
import { contactSubmissionSchema } from "./contact.validation.js";

const contactRouter = Router();

// POST /api/contact
// Deliver a validated contact request to the JobsSpot inbox and attempt to
// send a confirmation email to the sender.
contactRouter.post(
    "/",
    contactRateLimiter,
    validate(contactSubmissionSchema),
    asyncHandler(submitContactMessageController),
);

export default contactRouter;
