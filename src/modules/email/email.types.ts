export type TransactionalEmail = {
    to: string | string[];
    subject: string;
    html: string;
    text: string;
    idempotencyKey?: string;
    replyTo?: string;
};

export type RenderedEmail = {
    subject: string;
    html: string;
    text: string;
};

export type EmailActionTemplateInput = {
    recipientName: string;
    actionUrl: string;
};
