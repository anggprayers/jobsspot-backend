import type { CompanyMemberRole } from "../generated/prisma/client.js";

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                firstName: string;
                lastName: string;
                email: string;
                isAdmin: boolean;
            };

            companyMembership?: {
                id: string;
                companyId: string;
                userId: string;
                role: CompanyMemberRole;
            };
        }
    }
}

export {};
