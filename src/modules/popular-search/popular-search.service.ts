import { prisma } from "../../lib/prisma.js";

import type {
    PopularSearchesQuery,
    TrackPopularSearchBody,
} from "./popular-search.validation.js";

function normalizeSearchTerm(value: string): {
    keyword: string;
    normalizedTerm: string;
} {
    const keyword = value
        .trim()
        .replace(/\s+/g, " ");

    return {
        keyword,
        normalizedTerm: keyword.toLocaleLowerCase(
            "en-US",
        ),
    };
}

function getUtcDateOnly(value: Date): Date {
    return new Date(
        Date.UTC(
            value.getUTCFullYear(),
            value.getUTCMonth(),
            value.getUTCDate(),
        ),
    );
}

function getSearchWindowStart(days: number): Date {
    const today = getUtcDateOnly(new Date());

    today.setUTCDate(today.getUTCDate() - (days - 1));

    return today;
}

export async function trackPopularSearch({
    keyword,
}: TrackPopularSearchBody) {
    const {
        keyword: displayKeyword,
        normalizedTerm,
    } = normalizeSearchTerm(keyword);

    const now = new Date();
    const searchDate = getUtcDateOnly(now);

    return prisma.$transaction(async (transaction) => {
        const popularSearch =
            await transaction.popularSearch.upsert({
                where: {
                    normalizedTerm,
                },

                create: {
                    keyword: displayKeyword,
                    normalizedTerm,
                    searchCount: 1,
                    lastSearchedAt: now,
                },

                update: {
                    keyword: displayKeyword,
                    searchCount: {
                        increment: 1,
                    },
                    lastSearchedAt: now,
                },

                select: {
                    id: true,
                    keyword: true,
                    normalizedTerm: true,
                    searchCount: true,
                    lastSearchedAt: true,
                },
            });

        await transaction.popularSearchDailyCount.upsert({
            where: {
                popularSearchId_searchDate: {
                    popularSearchId: popularSearch.id,
                    searchDate,
                },
            },

            create: {
                popularSearchId: popularSearch.id,
                searchDate,
                searchCount: 1,
            },

            update: {
                searchCount: {
                    increment: 1,
                },
            },
        });

        return popularSearch;
    });
}

export async function listPopularSearches({
    limit,
    days,
}: PopularSearchesQuery) {
    const searchWindowStart =
        getSearchWindowStart(days);

    const groupedCounts =
        await prisma.popularSearchDailyCount.groupBy({
            by: ["popularSearchId"],

            where: {
                searchDate: {
                    gte: searchWindowStart,
                },
            },

            _sum: {
                searchCount: true,
            },

            _max: {
                updatedAt: true,
            },

            orderBy: [
                {
                    _sum: {
                        searchCount: "desc",
                    },
                },
                {
                    _max: {
                        updatedAt: "desc",
                    },
                },
            ],

            take: limit,
        });

    if (groupedCounts.length === 0) {
        return [];
    }

    const popularSearchIds = groupedCounts.map(
        (item) => item.popularSearchId,
    );

    const popularSearches =
        await prisma.popularSearch.findMany({
            where: {
                id: {
                    in: popularSearchIds,
                },
            },

            select: {
                id: true,
                keyword: true,
                normalizedTerm: true,
                lastSearchedAt: true,
            },
        });

    const popularSearchById = new Map(
        popularSearches.map((item) => [
            item.id,
            item,
        ]),
    );

    return groupedCounts.flatMap((group) => {
        const popularSearch =
            popularSearchById.get(
                group.popularSearchId,
            );

        if (!popularSearch) {
            return [];
        }

        return [
            {
                ...popularSearch,
                searchCount:
                    group._sum.searchCount ?? 0,
            },
        ];
    });
}
