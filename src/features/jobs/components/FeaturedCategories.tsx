"use client";

import Link from "next/link";
import {
    ArrowRight,
    BookOpen,
    BriefcaseBusiness,
    Code2,
    GraduationCap,
    HeartPulse,
    Landmark,
    Megaphone,
    Palette,
    RefreshCw,
    ShoppingBag,
    Users,
} from "lucide-react";

import Container from "@/components/layout/Container";

import { useJobCategories } from "../hooks/useJobCategories";

const categoryIcons = {
    education: GraduationCap,
    technology: Code2,
    healthcare: HeartPulse,
    marketing: Megaphone,
    design: Palette,
    finance: Landmark,
    sales: ShoppingBag,
    "human-resources": Users,
} as const;

function getCategoryIcon(slug: string) {
    return categoryIcons[slug as keyof typeof categoryIcons] ?? BriefcaseBusiness;
}

function formatJobCount(jobCount: number) {
    if (jobCount === 1) {
        return "1 open position";
    }

    return `${jobCount} open positions`;
}

function FeaturedCategoriesSkeleton() {
    return (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
                <div
                    key={index}
                    className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-slate-100"
                />
            ))}
        </div>
    );
}

export default function FeaturedCategories() {
    const {
        data,
        isLoading,
        isError,
        isFetching,
        refetch,
    } = useJobCategories();

    const categories = data?.categories ?? [];

    return (
        <section className="bg-white py-20 sm:py-24">
            <Container>
                <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
                    <div>
                        <p className="text-sm font-semibold uppercase tracking-widest text-blue-600">
                            Explore opportunities
                        </p>

                        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                            Browse jobs by category
                        </h2>

                        <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                            Discover available roles across industries and find opportunities that
                            match your skills and interests.
                        </p>
                    </div>

                    <Link
                        href="/jobs"
                        className="inline-flex shrink-0 items-center gap-2 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700"
                    >
                        View all jobs
                        <ArrowRight size={17} />
                    </Link>
                </div>

                <div className="mt-10">
                    {isLoading && <FeaturedCategoriesSkeleton />}

                    {isError && (
                        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-6">
                            <p className="font-semibold text-red-800">
                                Job categories are temporarily unavailable
                            </p>

                            <p className="mt-1 text-sm leading-6 text-red-600">
                                We could not load the categories right now.
                                Please try again shortly.
                            </p>

                            <button
                                type="button"
                                disabled={isFetching}
                                onClick={() => void refetch()}
                                className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                <RefreshCw
                                    size={16}
                                    className={
                                        isFetching
                                            ? "animate-spin"
                                            : undefined
                                    }
                                />

                                {isFetching
                                    ? "Trying again..."
                                    : "Try again"}
                            </button>
                        </div>
                    )}

                    {!isLoading && !isError && categories.length === 0 && (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-6 py-10 text-center">
                            <BookOpen className="mx-auto text-slate-400" size={30} />

                            <p className="mt-4 font-semibold text-slate-900">
                                No categories are available yet.
                            </p>

                            <p className="mt-2 text-sm text-slate-600">
                                Job categories will appear here once they become available.
                            </p>
                        </div>
                    )}

                    {!isLoading && !isError && categories.length > 0 && (
                        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                            {categories.map((category) => {
                                const Icon = getCategoryIcon(category.slug);

                                return (
                                    <Link
                                        key={category.id}
                                        href={`/jobs?category=${encodeURIComponent(category.slug)}`}
                                        className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg hover:shadow-slate-200/70"
                                    >
                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 transition-colors group-hover:bg-blue-600 group-hover:text-white">
                                            <Icon size={23} />
                                        </div>

                                        <h3 className="mt-5 text-lg font-semibold text-slate-950">
                                            {category.name}
                                        </h3>

                                        <div className="mt-2 flex items-center justify-between gap-3">
                                            <p className="text-sm text-slate-500">
                                                {formatJobCount(category.jobCount)}
                                            </p>

                                            <ArrowRight
                                                size={17}
                                                className="shrink-0 text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-blue-600"
                                            />
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    )}
                </div>
            </Container>
        </section>
    );
}
