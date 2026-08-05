export type AppErrorDetails = Record<string, unknown>;

export type AppErrorOptions = {
    details?: AppErrorDetails;
    headers?: Record<string, string>;
};

export class AppError extends Error {
    public readonly statusCode: number;
    public readonly details: AppErrorDetails | undefined;
    public readonly headers: Record<string, string> | undefined;

    constructor(
        statusCode: number,
        message: string,
        options: AppErrorOptions = {},
    ) {
        super(message);

        this.statusCode = statusCode;
        this.details = options.details;
        this.headers = options.headers;

        this.name = this.constructor.name;

        Error.captureStackTrace?.(this, this.constructor);
    }
}
