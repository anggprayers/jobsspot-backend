import type { Prisma } from "../../generated/prisma/client.js";

const COMPANY_MEMBERSHIP_LOCK_NAMESPACE = 124670856;

/**
 * Serializes writes for one company/user membership pair inside the current
 * PostgreSQL transaction. PostgreSQL releases the lock automatically when
 * the transaction finishes.
 */
export async function lockCompanyMembership(
    transaction: Prisma.TransactionClient,
    companyId: string,
    userId: string,
): Promise<void> {
    const lockKey = `${companyId}:${userId}`;

    await transaction.$queryRaw<
        Array<{ lockResult: string }>
    >`
        SELECT pg_advisory_xact_lock(
            ${COMPANY_MEMBERSHIP_LOCK_NAMESPACE},
            hashtext(${lockKey}::text)
        )::text AS "lockResult"
    `;
}
