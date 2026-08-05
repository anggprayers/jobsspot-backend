"use client";

import Image from "next/image";
import Link from "next/link";
import {
    AlertCircle,
    ArrowLeft,
    ArrowRight,
    BriefcaseBusiness,
    Building2,
    CalendarDays,
    Download,
    FileText,
    LoaderCircle,
    MapPin,
    RefreshCw,
    SearchX,
    Undo2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

import {
    useApplicationResumeDownload,
    useApplications,
    useApplicationsSummary,
} from "../hooks/useApplications";
import type {
    ApplicationStatus,
    JobSeekerApplication,
} from "../types/application";
import {
    formatApplicationDate,
    formatApplicationDateTime,
    formatApplicationEnum,
    formatApplicationStatus,
    getApplicationErrorMessage,
    getApplicationStatusClasses,
} from "../utils/applicationFormatters";
import WithdrawApplicationDialog from "./WithdrawApplicationDialog";

const PAGE_SIZE = 10;

const statusOptions: Array<{
    value: ApplicationStatus | "ALL";
    label: string;
}> = [
    { value: "ALL", label: "All applications" },
    { value: "SUBMITTED", label: "Submitted" },
    { value: "UNDER_REVIEW", label: "Under review" },
    { value: "SHORTLISTED", label: "Shortlisted" },
    { value: "INTERVIEW", label: "Interview" },
    { value: "OFFERED", label: "Offer received" },
    { value: "HIRED", label: "Hired" },
    { value: "REJECTED", label: "Rejected" },
    { value: "WITHDRAWN", label: "Withdrawn" },
];

function canWithdrawApplication(application: JobSeekerApplication): boolean {
    return !["HIRED", "REJECTED", "WITHDRAWN"].includes(application.status);
}

function getCompanyInitials(companyName: string): string {
    const words = companyName.trim().split(/\s+/).filter(Boolean);

    if (words.length === 0) {
        return "CO";
    }

    if (words.length === 1) {
        return words[0].slice(0, 2).toUpperCase();
    }

    return words
        .slice(0, 2)
        .map((word) => word.charAt(0))
        .join("")
        .toUpperCase();
}

function openSecureDownload(downloadUrl: string) {
    const link = document.createElement("a");

    link.href = downloadUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";

    document.body.appendChild(link);
    link.click();
    link.remove();
}

function ApplicationsSkeleton() {
    return (
        <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
                <div
                    key={index}
                    className="h-72 animate-pulse rounded-2xl border border-slate-200 bg-white"
                />
            ))}
        </div>
    );
}

export default function JobSeekerApplicationsPage() {
    const [status, setStatus] = useState<ApplicationStatus | "ALL">("ALL");
    const [page, setPage] = useState(1);
    const [applicationBeingWithdrawn, setApplicationBeingWithdrawn] =
        useState<JobSeekerApplication | null>(null);
    const [downloadingApplicationId, setDownloadingApplicationId] =
        useState<string | null>(null);

    const applicationsQuery = useApplications({
        ...(status !== "ALL" && { status }),
        page,
        limit: PAGE_SIZE,
    });

    const summaryQuery = useApplicationsSummary();
    const resumeDownloadMutation = useApplicationResumeDownload();

    const applications = applicationsQuery.data?.applications ?? [];
    const summary = summaryQuery.data?.summary;
    const pagination = applicationsQuery.data?.pagination;
    const progressingCount = summary
        ? summary.shortlisted + summary.interviews + summary.offered
        : 0;

    function formatSummaryValue(value: number | undefined): string {
        if (summaryQuery.isLoading) {
            return "...";
        }

        return String(value ?? 0);
    }

    function handleStatusChange(nextStatus: ApplicationStatus | "ALL") {
        setStatus(nextStatus);
        setPage(1);
    }

    async function handleResumeDownload(
        application: JobSeekerApplication,
    ) {
        if (
            !application.resume ||
            resumeDownloadMutation.isPending
        ) {
            return;
        }

        setDownloadingApplicationId(application.id);

        const toastId = toast.loading(
            "Preparing secure resume download...",
        );

        try {
            const response =
                await resumeDownloadMutation.mutateAsync(
                    application.id,
                );

            openSecureDownload(response.downloadUrl);

            toast.success("Resume opened securely.", {
                id: toastId,
                description: `The private link expires in ${Math.round(
                    response.expiresInSeconds / 60,
                )} minutes.`,
            });
        } catch (error) {
            toast.error(
                getApplicationErrorMessage(
                    error,
                    "Unable to open the submitted resume.",
                ),
                {
                    id: toastId,
                },
            );
        } finally {
            setDownloadingApplicationId(null);
        }
    }

    return (
        <div className="space-y-6">
            <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                    <div>
                        <p className="text-sm font-bold uppercase tracking-[0.16em] text-blue-600">
                            Job seeker
                        </p>

                        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                            Applications
                        </h1>

                        <p className="mt-3 max-w-2xl leading-7 text-slate-600">
                            Review the jobs you applied for, track each hiring
                            status, and withdraw applications that are still active.
                        </p>
                    </div>

                    <Button asChild variant="outline">
                        <Link href="/jobs">
                            <BriefcaseBusiness />
                            Browse jobs
                        </Link>
                    </Button>
                </div>
            </header>

            <section
                aria-label="Application summary"
                className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            >
                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Total applications</CardDescription>
                        <CardTitle className="text-3xl">
                            {formatSummaryValue(summary?.totalApplications)}
                        </CardTitle>
                    </CardHeader>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Awaiting review</CardDescription>
                        <CardTitle className="text-3xl">
                            {formatSummaryValue(
                                summary
                                    ? summary.submitted +
                                          summary.underReview
                                    : undefined,
                            )}
                        </CardTitle>
                    </CardHeader>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Progressing</CardDescription>
                        <CardTitle className="text-3xl">
                            {formatSummaryValue(summary ? progressingCount : undefined)}
                        </CardTitle>
                    </CardHeader>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardDescription>Successful</CardDescription>
                        <CardTitle className="text-3xl">
                            {formatSummaryValue(summary?.hired)}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </section>

            <Card>
                <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <CardTitle>Your applications</CardTitle>
                        <CardDescription className="mt-1.5">
                            Filter the list by its current hiring status.
                        </CardDescription>
                    </div>

                    <label className="block min-w-52">
                        <span className="sr-only">
                            Filter applications by status
                        </span>

                        <select
                            value={status}
                            onChange={(event) =>
                                handleStatusChange(
                                    event.target.value as
                                        | ApplicationStatus
                                        | "ALL",
                                )
                            }
                            className="flex min-h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                        >
                            {statusOptions.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>
                </CardHeader>

                <CardContent>
                    {applicationsQuery.isLoading && <ApplicationsSkeleton />}

                    {applicationsQuery.isError && (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-12 text-center">
                            <AlertCircle className="mx-auto size-10 text-red-500" />

                            <h2 className="mt-4 text-xl font-semibold text-red-900">
                                Unable to load applications
                            </h2>

                            <p className="mx-auto mt-2 max-w-lg leading-7 text-red-700">
                                We could not load your applications right now.
                                Please try again in a moment.
                            </p>

                            <Button
                                type="button"
                                variant="outline"
                                className="mt-5"
                                disabled={applicationsQuery.isFetching}
                                onClick={() => void applicationsQuery.refetch()}
                            >
                                <RefreshCw
                                    className={
                                        applicationsQuery.isFetching
                                            ? "animate-spin"
                                            : undefined
                                    }
                                />
                                {applicationsQuery.isFetching
                                    ? "Trying again..."
                                    : "Try again"}
                            </Button>
                        </div>
                    )}

                    {!applicationsQuery.isLoading &&
                        !applicationsQuery.isError &&
                        applications.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center">
                                <SearchX className="mx-auto size-11 text-slate-400" />

                                <h2 className="mt-4 text-xl font-semibold text-slate-950">
                                    {status === "ALL"
                                        ? "No applications yet"
                                        : `No ${formatApplicationStatus(
                                              status,
                                          ).toLowerCase()} applications`}
                                </h2>

                                <p className="mx-auto mt-2 max-w-md leading-7 text-slate-600">
                                    {status === "ALL"
                                        ? "Explore available jobs and submit your first application."
                                        : "Choose a different status to view your other applications."}
                                </p>

                                {status === "ALL" && (
                                    <Button asChild className="mt-5">
                                        <Link href="/jobs">
                                            <BriefcaseBusiness />
                                            Explore jobs
                                        </Link>
                                    </Button>
                                )}
                            </div>
                        )}

                    {!applicationsQuery.isLoading &&
                        !applicationsQuery.isError &&
                        applications.length > 0 && (
                            <div className="space-y-4">
                                {applications.map((application) => (
                                    <article
                                        key={application.id}
                                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                                    >
                                        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                                            <div className="flex min-w-0 items-start gap-4">
                                                <Link
                                                    href={`/companies/${application.job.company.slug}`}
                                                    className="relative flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-blue-100 bg-blue-50 font-bold text-blue-600"
                                                >
                                                    {application.job.company.logoUrl ? (
                                                        <Image
                                                            src={
                                                                application.job
                                                                    .company.logoUrl
                                                            }
                                                            alt={`${application.job.company.name} logo`}
                                                            fill
                                                            sizes="56px"
                                                            className="object-cover"
                                                        />
                                                    ) : (
                                                        getCompanyInitials(
                                                            application.job.company
                                                                .name,
                                                        )
                                                    )}
                                                </Link>

                                                <div className="min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <span
                                                            className={`rounded-full border px-2.5 py-1 text-xs font-bold ${getApplicationStatusClasses(
                                                                application.status,
                                                            )}`}
                                                        >
                                                            {formatApplicationStatus(
                                                                application.status,
                                                            )}
                                                        </span>

                                                        <span className="text-sm text-slate-500">
                                                            Applied{" "}
                                                            {formatApplicationDate(
                                                                application.appliedAt,
                                                            )}
                                                        </span>
                                                    </div>

                                                    <Link
                                                        href={`/jobs/${application.job.slug}`}
                                                        className="mt-3 block text-xl font-bold text-slate-950 transition-colors hover:text-blue-600"
                                                    >
                                                        {application.job.title}
                                                    </Link>

                                                    <Link
                                                        href={`/companies/${application.job.company.slug}`}
                                                        className="mt-1 inline-flex items-center gap-2 font-semibold text-slate-600 hover:text-blue-600"
                                                    >
                                                        <Building2 className="size-4" />
                                                        {application.job.company.name}
                                                    </Link>

                                                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500">
                                                        <span className="inline-flex items-center gap-1.5">
                                                            <MapPin className="size-4" />
                                                            {application.job.location ??
                                                                "Location not specified"}
                                                        </span>

                                                        <span className="inline-flex items-center gap-1.5">
                                                            <BriefcaseBusiness className="size-4" />
                                                            {formatApplicationEnum(
                                                                application.job
                                                                    .employmentType,
                                                            )}
                                                        </span>

                                                        <span className="inline-flex items-center gap-1.5">
                                                            <CalendarDays className="size-4" />
                                                            Updated{" "}
                                                            {formatApplicationDateTime(
                                                                application.updatedAt,
                                                            )}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                        </div>

                                        <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 lg:grid-cols-2">
                                            <div className="rounded-xl bg-slate-50 p-4">
                                                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                                                    <FileText className="size-4 text-blue-600" />
                                                    Submitted resume
                                                </div>

                                                {application.resume ? (
                                                    <button
                                                        type="button"
                                                        disabled={
                                                            resumeDownloadMutation.isPending
                                                        }
                                                        onClick={() =>
                                                            void handleResumeDownload(
                                                                application,
                                                            )
                                                        }
                                                        className="mt-3 inline-flex max-w-full items-center gap-2 text-left text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
                                                    >
                                                        {downloadingApplicationId ===
                                                        application.id ? (
                                                            <LoaderCircle className="size-4 shrink-0 animate-spin" />
                                                        ) : (
                                                            <Download className="size-4 shrink-0" />
                                                        )}

                                                        <span className="truncate">
                                                            {
                                                                application
                                                                    .resume.name
                                                            }
                                                        </span>
                                                    </button>
                                                ) : (
                                                    <p className="mt-2 text-sm text-slate-600">
                                                        Resume is no longer
                                                        available
                                                    </p>
                                                )}

                                                {application.resume && (
                                                    <p className="mt-1 text-xs text-slate-500">
                                                        Open the exact private
                                                        resume attached to this
                                                        application.
                                                    </p>
                                                )}
                                            </div>

                                            <div className="rounded-xl bg-slate-50 p-4">
                                                <p className="text-sm font-semibold text-slate-900">
                                                    Cover letter
                                                </p>

                                                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-slate-600">
                                                    {application.coverLetter ??
                                                        "No cover letter was included."}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="mt-5 flex flex-col items-stretch gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-center xl:justify-end">
                                            <Button
                                                asChild
                                                variant="outline"
                                                className="w-full sm:w-auto"
                                            >
                                                <Link
                                                    href={`/jobs/${application.job.slug}`}
                                                >
                                                    View job
                                                </Link>
                                            </Button>

                                            {canWithdrawApplication(
                                                application,
                                            ) && (
                                                <Button
                                                    type="button"
                                                    variant="destructive"
                                                    className="w-full sm:w-auto"
                                                    onClick={() =>
                                                        setApplicationBeingWithdrawn(
                                                            application,
                                                        )
                                                    }
                                                >
                                                    <Undo2 />
                                                    Withdraw application
                                                </Button>
                                            )}
                                        </div>
                                    </article>
                                ))}
                            </div>
                        )}

                    {pagination && pagination.totalItems > 0 && (
                        <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-5 sm:flex-row">
                            <p className="text-sm text-slate-500">
                                Page {pagination.page} of {pagination.totalPages} ·{" "}
                                {pagination.totalItems} application
                                {pagination.totalItems === 1 ? "" : "s"}
                            </p>

                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={
                                        !pagination.hasPreviousPage ||
                                        applicationsQuery.isFetching
                                    }
                                    onClick={() =>
                                        setPage((current) =>
                                            Math.max(1, current - 1),
                                        )
                                    }
                                >
                                    {applicationsQuery.isFetching ? (
                                        <LoaderCircle className="animate-spin" />
                                    ) : (
                                        <ArrowLeft />
                                    )}
                                    Previous
                                </Button>

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={
                                        !pagination.hasNextPage ||
                                        applicationsQuery.isFetching
                                    }
                                    onClick={() =>
                                        setPage((current) => current + 1)
                                    }
                                >
                                    Next
                                    {applicationsQuery.isFetching ? (
                                        <LoaderCircle className="animate-spin" />
                                    ) : (
                                        <ArrowRight />
                                    )}
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <WithdrawApplicationDialog
                application={applicationBeingWithdrawn}
                open={Boolean(applicationBeingWithdrawn)}
                onOpenChange={(open) => {
                    if (!open) {
                        setApplicationBeingWithdrawn(null);
                    }
                }}
            />
        </div>
    );
}
