import { Resend } from "resend";

import { emailConfig } from "../modules/email/email.config.js";

export const resend = new Resend(
    emailConfig.resendApiKey,
);
