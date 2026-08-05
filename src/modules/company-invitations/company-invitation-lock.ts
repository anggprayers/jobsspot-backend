import type { Prisma } from "../../generated/prisma/client.js";

const COMPANY_INVITATION_RESOURCE_LOCK_NAMESPACE = 124670858;

/**
 * Serializes mutations for one invitation row inside the current PostgreSQL
 * transaction. PostgreSQL releases the lock automatically when the
 * transaction finishes.
 */
export async function lockCompanyInvitationResource(
    transaction: Prisma.TransactionClient,
    invitationId: string,
): Promise<void> {
    await transaction.$queryRaw<
        Array<{ lockResult: string }>
    >`
        SELECT pg_advisory_xact_lock(
            ${COMPANY_INVITATION_RESOURCE_LOCK_NAMESPACE},
            hashtext(${invitationId}::text)
        )::text AS "lockResult"
    `;
}
