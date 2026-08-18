import { WorkplaceType } from "../../generated/prisma/client.js";

const US_STATE_NAMES: Record<string, string> = {
    AL: "Alabama",
    AK: "Alaska",
    AZ: "Arizona",
    AR: "Arkansas",
    CA: "California",
    CO: "Colorado",
    CT: "Connecticut",
    DE: "Delaware",
    DC: "District of Columbia",
    FL: "Florida",
    GA: "Georgia",
    HI: "Hawaii",
    ID: "Idaho",
    IL: "Illinois",
    IN: "Indiana",
    IA: "Iowa",
    KS: "Kansas",
    KY: "Kentucky",
    LA: "Louisiana",
    ME: "Maine",
    MD: "Maryland",
    MA: "Massachusetts",
    MI: "Michigan",
    MN: "Minnesota",
    MS: "Mississippi",
    MO: "Missouri",
    MT: "Montana",
    NE: "Nebraska",
    NV: "Nevada",
    NH: "New Hampshire",
    NJ: "New Jersey",
    NM: "New Mexico",
    NY: "New York",
    NC: "North Carolina",
    ND: "North Dakota",
    OH: "Ohio",
    OK: "Oklahoma",
    OR: "Oregon",
    PA: "Pennsylvania",
    RI: "Rhode Island",
    SC: "South Carolina",
    SD: "South Dakota",
    TN: "Tennessee",
    TX: "Texas",
    UT: "Utah",
    VT: "Vermont",
    VA: "Virginia",
    WA: "Washington",
    WV: "West Virginia",
    WI: "Wisconsin",
    WY: "Wyoming",
};

type StructuredJobLocation = {
    workplaceType: WorkplaceType;
    city: string | null;
    stateRegion: string | null;
    countryCode: string;
};

export function normalizeJobLocationPart(value: string | null | undefined): string | null {
    const normalized = value?.trim() ?? "";

    return normalized || null;
}

export function normalizeJobCountryCode(value: string | null | undefined): string {
    return (value?.trim() || "US").toUpperCase();
}

export function normalizeJobStateRegion(
    value: string | null | undefined,
    countryCode: string,
): string | null {
    const normalized = normalizeJobLocationPart(value);

    if (!normalized) {
        return null;
    }

    return countryCode === "US" ? normalized.toUpperCase() : normalized;
}

export function getStructuredJobLocationIssues({
    workplaceType,
    city,
    stateRegion,
    countryCode,
}: StructuredJobLocation): string[] {
    const issues: string[] = [];

    if (!/^[A-Z]{2}$/.test(countryCode)) {
        issues.push("Country must use a 2-letter country code.");
    }

    if (countryCode === "US" && stateRegion && !US_STATE_NAMES[stateRegion]) {
        issues.push("Select a valid U.S. state or region.");
    }

    if (workplaceType !== WorkplaceType.REMOTE) {
        if (!city) {
            issues.push("Add the city for an on-site or hybrid job.");
        }

        if (!stateRegion) {
            issues.push("Add the state or region for an on-site or hybrid job.");
        }
    }

    return issues;
}

export function formatStructuredJobLocation({
    city,
    stateRegion,
    countryCode,
}: Omit<StructuredJobLocation, "workplaceType">): string {
    const normalizedCountryCode = normalizeJobCountryCode(countryCode);
    const normalizedCity = normalizeJobLocationPart(city);
    const normalizedStateRegion = normalizeJobStateRegion(stateRegion, normalizedCountryCode);

    if (normalizedCountryCode === "US") {
        if (normalizedCity && normalizedStateRegion) {
            return `${normalizedCity}, ${normalizedStateRegion}`;
        }

        if (normalizedCity) {
            return `${normalizedCity}, United States`;
        }

        if (normalizedStateRegion) {
            const stateName = US_STATE_NAMES[normalizedStateRegion] ?? normalizedStateRegion;

            return `${stateName}, United States`;
        }

        return "United States";
    }

    const localParts = [normalizedCity, normalizedStateRegion].filter(
        (value): value is string => Boolean(value),
    );

    return localParts.length > 0
        ? [...localParts, normalizedCountryCode].join(", ")
        : normalizedCountryCode;
}
