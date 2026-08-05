"use client";

import {
    BriefcaseBusiness,
    RefreshCw,
    SearchX,
} from "lucide-react";
import { useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import SaveSearchFooter from "@/features/saved-searches/components/SaveSearchFooter";
import SavedSearchQuickAccess from "@/features/saved-searches/components/SavedSearchQuickAccess";

import JobListItem from "./JobListItem";
import JobsPagination from "./JobsPagination";
import JobsToolbar from "./JobsToolbar";

import { usePublicJobs } from "../hooks/usePublicJobs";
import type { JobsSortOption } from "../types/jobFilters";

function JobsResultsSkeleton() {
    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {Array.from({ length: 5 }).map(
                (_, index) => (
                    <div
                        key={index}
                        className="border-b border-slate-200 px-5 py-8 last:border-b-0 sm:px-7"
                    >
                        <div className="flex animate-pulse gap-5">
                            <div className="h-16 w-16 shrink-0 rounded-2xl bg-slate-200" />

                            <div className="flex-1">
                                <div className="h-6 w-2/5 rounded bg-slate-200" />
                                <div className="mt-3 h-4 w-1/4 rounded bg-slate-100" />

                                <div className="mt-5 flex flex-wrap gap-2">
                                    <div className="h-7 w-20 rounded-full bg-slate-100" />
                                    <div className="h-7 w-24 rounded-full bg-slate-100" />
                                    <div className="h-7 w-20 rounded-full bg-slate-100" />
                                </div>
                            </div>
                        </div>
                    </div>
                ),
            )}
        </div>
    );
}

function getPositiveInteger(
    value: string | null,
    fallback: number,
) {
    const parsedValue = Number(value);

    if (
        !Number.isInteger(parsedValue) ||
        parsedValue < 1
    ) {
        return fallback;
    }

    return parsedValue;
}

function getCommaSeparatedQueryValue(
    searchParams: ReturnType<
        typeof useSearchParams
    >,
    name: string,
): string | undefined {
    const values = searchParams
        .getAll(name)
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(Boolean);

    if (values.length === 0) {
        return undefined;
    }

    return [...new Set(values)].join(",");
}

export default function JobsResults() {
    const searchParams = useSearchParams();

    const page = getPositiveInteger(
        searchParams.get("page"),
        1,
    );
    const limit = 10;

    const sort =
        (searchParams.get(
            "sort",
        ) as JobsSortOption | null) ?? "newest";

    const {
        data,
        isLoading,
        isError,
        isFetching,
        refetch,
    } = usePublicJobs({
            page,
            limit,
            sort,
            search:
                searchParams.get("search") ||
                undefined,
            location:
                searchParams.get("location") ||
                undefined,
            category:
                getCommaSeparatedQueryValue(
                    searchParams,
                    "category",
                ),
            employmentType:
                getCommaSeparatedQueryValue(
                    searchParams,
                    "employmentType",
                ),
            workplaceType:
                getCommaSeparatedQueryValue(
                    searchParams,
                    "workplaceType",
                ),
            experienceLevel:
                getCommaSeparatedQueryValue(
                    searchParams,
                    "experienceLevel",
                ),
            salaryPeriod:
                searchParams.get(
                    "salaryPeriod",
                ) || undefined,
            salaryMin:
                searchParams.get("salaryMin") ||
                undefined,
            salaryMax:
                searchParams.get("salaryMax") ||
                undefined,
            salaryCurrency:
                searchParams.get(
                    "salaryCurrency",
                ) || undefined,
            publishedWithinDays:
                searchParams.get(
                    "publishedWithinDays",
                ) || undefined,
        });

    const jobs = data?.jobs ?? [];
    const pagination = data?.pagination;

    return (
        <div>
            <SavedSearchQuickAccess />

            <section className="min-w-0">
                <JobsToolbar
                    totalItems={
                        pagination?.totalItems ?? 0
                    }
                    isLoading={isLoading}
                />

                <div className="mt-6">
                    {isLoading && (
                        <JobsResultsSkeleton />
                    )}

                    {isError && (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-14 text-center">
                            <BriefcaseBusiness
                                size={38}
                                className="mx-auto text-red-400"
                            />

                            <h3 className="mt-4 text-xl font-semibold text-red-800">
                                Jobs are temporarily unavailable
                            </h3>

                            <p className="mx-auto mt-2 max-w-md leading-7 text-red-600">
                                We could not load the available
                                positions right now. Please try
                                again in a moment.
                            </p>

                            <Button
                                type="button"
                                variant="outline"
                                className="mt-5 border-red-200 bg-white text-red-700 hover:bg-red-100 hover:text-red-800"
                                disabled={isFetching}
                                onClick={() => void refetch()}
                            >
                                <RefreshCw
                                    className={
                                        isFetching
                                            ? "animate-spin"
                                            : undefined
                                    }
                                />

                                {isFetching
                                    ? "Trying again..."
                                    : "Try again"}
                            </Button>
                        </div>
                    )}

                    {!isLoading &&
                        !isError &&
                        jobs.length === 0 && (
                            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
                                <SearchX
                                    size={42}
                                    className="mx-auto text-slate-400"
                                />

                                <h3 className="mt-5 text-2xl font-semibold text-slate-950">
                                    No matching jobs found
                                </h3>

                                <p className="mx-auto mt-3 max-w-md leading-7 text-slate-600">
                                    Try changing your search
                                    terms, location, pay
                                    range, or selected
                                    filters.
                                </p>
                            </div>
                        )}

                    {!isLoading &&
                        !isError &&
                        jobs.length > 0 && (
                            <>
                                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                                    {jobs.map((job) => (
                                        <JobListItem
                                            key={
                                                job.id
                                            }
                                            job={job}
                                        />
                                    ))}
                                </div>

                                <SaveSearchFooter />

                                {pagination && (
                                    <JobsPagination
                                        currentPage={
                                            pagination.page
                                        }
                                        totalPages={
                                            pagination.totalPages
                                        }
                                        hasNextPage={
                                            pagination.hasNextPage
                                        }
                                        hasPreviousPage={
                                            pagination.hasPreviousPage
                                        }
                                    />
                                )}
                            </>
                        )}
                </div>
            </section>
        </div>
    );
}
