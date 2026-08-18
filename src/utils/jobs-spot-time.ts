export const JOBS_SPOT_TIME_ZONE = "America/New_York";

export function formatJobsSpotDateTime(value: Date): string {
    return new Intl.DateTimeFormat("en-US", {
        timeZone: JOBS_SPOT_TIME_ZONE,
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short",
    }).format(value);
}
