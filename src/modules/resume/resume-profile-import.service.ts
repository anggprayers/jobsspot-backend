import path from "node:path";

import * as mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { CanvasFactory } from "pdf-parse/worker";

import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../errors/AppError.js";
import { prisma } from "../../lib/prisma.js";
import { createSlug } from "../../utils/slug.js";
import { getResumeObjectBuffer } from "./resume-storage.service.js";
import type { ImportResumeProfileBody } from "./resume-profile-import.validation.js";

const MAX_RESUME_TEXT_CHARS = 120_000;
const MAX_IMPORT_TRANSACTION_MS = 20_000;

const MONTHS: Record<string, number> = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
};

const SECTION_ALIASES = {
    summary: ["professional summary", "summary", "profile", "career summary", "objective", "career objective"],
    experience: ["work experience", "professional experience", "employment history", "experience"],
    education: ["education", "academic background", "academic history"],
    skills: ["technical skills", "skills", "core skills", "competencies", "technologies"],
    certifications: ["certifications", "certificates", "licenses", "licenses & certifications"],
} as const;

const STOP_SECTION_HEADINGS = new Set([
    "projects",
    "project experience",
    "selected projects",
    "portfolio",
    "awards",
    "recognitions",
    "achievements",
    "languages",
    "interests",
    "references",
    "volunteer experience",
    "volunteering",
    "activities",
    "training",
    "seminars",
    "publications",
]);

const GENERIC_SKILL_VALUES = new Set([
    "and",
    "or",
    "skills",
    "skill",
    "technical skills",
    "core skills",
    "competencies",
    "technologies",
    "projects",
]);

type SectionKey = keyof typeof SECTION_ALIASES;

type ParsedDateRange = {
    startDate: string;
    endDate: string | null;
    isCurrent: boolean;
    startIndex: number;
};

type ResumePreview = {
    parser: {
        sourceFormat: "PDF" | "DOCX";
        parserVersion: "LOCAL_HEURISTIC_V1";
        warnings: string[];
    };
    personal: {
        firstName: string | null;
        lastName: string | null;
        detectedEmail: string | null;
        phone: string | null;
        location: string | null;
    };
    professional: {
        headline: string | null;
        summary: string | null;
        websiteUrl: string | null;
        linkedInUrl: string | null;
        yearsOfExperience: number | null;
    };
    skills: string[];
    workExperiences: Array<{
        jobTitle: string;
        companyName: string;
        location: string | null;
        startDate: string;
        endDate: string | null;
        isCurrent: boolean;
        description: string | null;
    }>;
    education: Array<{
        institutionName: string;
        degree: string | null;
        fieldOfStudy: string | null;
        startDate: string | null;
        endDate: string | null;
        isCurrent: boolean;
        description: string | null;
    }>;
    certifications: Array<{
        name: string;
        issuingOrganization: string | null;
        issueDate: string | null;
        expirationDate: string | null;
        credentialId: string | null;
        credentialUrl: string | null;
    }>;
};

function normalizeLine(line: string): string {
    return line
        .replace(/[•▪◦●◆►]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function normalizeHeading(line: string): string {
    return normalizeLine(line)
        .toLowerCase()
        .replace(/[:|]+$/g, "")
        .replace(/[^a-z0-9& ]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function isSectionHeading(line: string): SectionKey | null {
    const normalized = normalizeHeading(line);

    for (const [key, aliases] of Object.entries(SECTION_ALIASES) as Array<[SectionKey, readonly string[]]>) {
        if (aliases.includes(normalized)) {
            return key;
        }
    }

    return null;
}

function isStopSectionHeading(line: string): boolean {
    return STOP_SECTION_HEADINGS.has(normalizeHeading(line));
}

function splitLines(text: string): string[] {
    return text.replace(/\r/g, "\n").split(/\n+/).map(normalizeLine).filter(Boolean).slice(0, 2_000);
}

function getSections(lines: string[]): Partial<Record<SectionKey, string[]>> {
    const sections: Partial<Record<SectionKey, string[]>> = {};
    let currentSection: SectionKey | null = null;

    for (const line of lines) {
        const heading = isSectionHeading(line);

        if (heading) {
            currentSection = heading;
            sections[currentSection] ??= [];
            continue;
        }

        if (isStopSectionHeading(line)) {
            currentSection = null;
            continue;
        }

        if (currentSection) {
            sections[currentSection]?.push(line);
        }
    }

    return sections;
}

function parseName(lines: string[]): { firstName: string | null; lastName: string | null; index: number } {
    for (let index = 0; index < Math.min(lines.length, 12); index += 1) {
        const line = lines[index];

        if (!line || isSectionHeading(line)) {
            continue;
        }

        if (/@|https?:\/\/|www\.|\d/.test(line) || line.length > 80) {
            continue;
        }

        const cleaned = line.replace(/[|]/g, " ").trim();
        const commaParts = cleaned
            .split(",")
            .map((part) => part.trim())
            .filter(Boolean);

        if (commaParts.length === 2 && commaParts[0] && commaParts[1]) {
            const lastName = commaParts[0];
            const firstName = commaParts[1].split(/\s+/)[0] ?? null;

            if (firstName && lastName) {
                return { firstName, lastName, index };
            }
        }

        const words = cleaned.split(/\s+/).filter(Boolean);

        if (words.length < 2 || words.length > 5) {
            continue;
        }

        if (!words.every((word) => /^[A-Za-zÀ-ÖØ-öø-ÿ.'’-]+$/.test(word))) {
            continue;
        }

        return {
            firstName: words[0] ?? null,
            lastName: words.slice(1).join(" ") || null,
            index,
        };
    }

    return { firstName: null, lastName: null, index: -1 };
}

function parseMonthYear(value: string): { year: number; month: number } | null {
    const normalized = value.trim().toLowerCase().replace(/\./g, "");
    const monthYear = normalized.match(/^([a-z]+)\s+(\d{4})$/);

    if (monthYear) {
        const month = MONTHS[monthYear[1] ?? ""];
        const year = Number(monthYear[2]);

        if (month && Number.isInteger(year)) {
            return { year, month };
        }
    }

    const yearOnly = normalized.match(/^(\d{4})$/);

    if (yearOnly) {
        return { year: Number(yearOnly[1]), month: 1 };
    }

    return null;
}

function toIsoDate(value: { year: number; month: number }): string {
    return `${String(value.year).padStart(4, "0")}-${String(value.month).padStart(2, "0")}-01`;
}

function parseDateRange(line: string): ParsedDateRange | null {
    const dateToken =
        "(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)[.]?\\s+\\d{4}|\\d{4}";
    const rangeRegex = new RegExp(`(${dateToken})\\s*(?:-|–|—|to)\\s*(Present|Current|Now|${dateToken})`, "i");
    const match = rangeRegex.exec(line);

    if (!match || !match[1] || !match[2]) {
        return null;
    }

    const start = parseMonthYear(match[1]);

    if (!start) {
        return null;
    }

    const isCurrent = /^(present|current|now)$/i.test(match[2]);
    const end = isCurrent ? null : parseMonthYear(match[2]);

    return {
        startDate: toIsoDate(start),
        endDate: end ? toIsoDate(end) : null,
        isCurrent,
        startIndex: match.index,
    };
}

function normalizeDetectedUrl(value: string): string {
    const cleaned = value.replace(/[),.;]+$/g, "");
    return /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned.replace(/^www\./i, "")}`;
}

function parseContact(lines: string[]) {
    const topText = lines.slice(0, 20).join("\n");
    const email = topText.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null;
    const phoneCandidate = topText.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0] ?? null;
    const phone = phoneCandidate?.replace(/\s+/g, " ").trim() ?? null;
    const urls = Array.from(
        topText.matchAll(/(?:https?:\/\/|www\.|linkedin\.com\/|[A-Z0-9.-]+\.(?:com|net|org|dev|app)\/)[^\s|]*/gi),
        (match) => normalizeDetectedUrl(match[0]),
    );
    const linkedInUrl = urls.find((url) => /linkedin\.com/i.test(url)) ?? null;
    const websiteUrl = urls.find((url) => !/linkedin\.com/i.test(url)) ?? null;

    return { email, phone, websiteUrl, linkedInUrl };
}

function parseLocation(lines: string[], excluded: Set<string>): string | null {
    const firstSectionIndex = lines.findIndex((line) => Boolean(isSectionHeading(line)) || isStopSectionHeading(line));
    const contactBlockEnd = firstSectionIndex >= 0 ? Math.min(firstSectionIndex, 18) : 12;
    const contactLines = lines.slice(0, contactBlockEnd);

    const sentenceLikeWords =
        /\b(?:installed|configured|updated|uninstalled|developed|designed|assisted|worked|managed|created|built|maintained|implemented|collaborated|responsible|familiar|knowledgeable|proficient|experience|skills?|summary|profile|objective|projects?|applications?|systems?|software|hardware|workstations?|laptops?|clients?|customers?)\b/i;

    const invalidLocationWords =
        /\b(?:email|phone|mobile|portfolio|linkedin|github|website|resume|curriculum|vitae|address)\b/i;

    for (const line of contactLines) {
        if (excluded.has(line)) {
            continue;
        }

        const candidates = line
            .split(/[|•·]/)
            .map((value) => value.trim())
            .filter(Boolean);

        for (const candidate of candidates) {
            if (
                excluded.has(candidate) ||
                /@|https?:\/\/|www\.|linkedin\.com|github\.com/i.test(candidate) ||
                /\+?\d[\d\s().-]{7,}\d/.test(candidate) ||
                /\d{4}/.test(candidate) ||
                sentenceLikeWords.test(candidate) ||
                invalidLocationWords.test(candidate)
            ) {
                continue;
            }

            const words = candidate.split(/\s+/).filter(Boolean);
            const parts = candidate
                .split(",")
                .map((part) => part.trim())
                .filter(Boolean);

            if (
                candidate.length < 3 ||
                candidate.length > 70 ||
                !candidate.includes(",") ||
                words.length > 8 ||
                /[.!?;:]/.test(candidate) ||
                parts.length < 2 ||
                parts.length > 4 ||
                parts.some((part) => part.length > 35 || part.split(/\s+/).length > 5)
            ) {
                continue;
            }

            const looksLikeLocation = parts.every((part) => /^[A-Za-zÀ-ÖØ-öø-ÿ0-9.'’()\-\s]+$/.test(part));

            if (!looksLikeLocation) {
                continue;
            }

            return candidate;
        }
    }

    return null;
}

function parseHeadline(lines: string[], nameIndex: number, excluded: Set<string>): string | null {
    if (nameIndex < 0) {
        return null;
    }

    for (const line of lines.slice(nameIndex + 1, nameIndex + 6)) {
        if (
            excluded.has(line) ||
            isSectionHeading(line) ||
            /@|https?:\/\/|www\.|\+?\d[\d\s().-]{7,}\d/.test(line) ||
            line.includes(",") ||
            line.length > 120
        ) {
            continue;
        }

        return line;
    }

    return null;
}

function parseSummary(sectionLines: string[] | undefined): string | null {
    if (!sectionLines?.length) {
        return null;
    }

    const text = sectionLines.join(" ").replace(/\s+/g, " ").trim();
    return text ? text.slice(0, 2_000) : null;
}

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function containsKnownSkill(text: string, skill: string): boolean {
    const escaped = escapeRegExp(skill.trim());
    if (!escaped) return false;

    return new RegExp(`(^|[^a-z0-9])${escaped}(?=$|[^a-z0-9])`, "i").test(text);
}

function cleanSkillCandidate(value: string): string {
    let skill = value
        .replace(/^[-–—•▪◦●◆►]+/, "")
        .replace(/^(?:and|or)\s+/i, "")
        .replace(
            /^(?:knowledgeable\s+in|familiar(?:ity)?\s+with|proficient\s+in|proficiency\s+in|experienced?\s+with|experience\s+in|skilled\s+in)\s+/i,
            "",
        )
        .trim();

    const qualifierIndex = skill.search(/\s+(?:for|to|while|using|including|such\s+as)\s+/i);
    if (qualifierIndex > 0) {
        skill = skill.slice(0, qualifierIndex).trim();
    }

    return skill.replace(/[.;:]+$/g, "").trim();
}

function isUsefulSkillCandidate(value: string): boolean {
    const normalized = value.toLowerCase();
    const words = value.split(/\s+/).filter(Boolean);

    return (
        value.length >= 2 &&
        value.length <= 60 &&
        words.length <= 4 &&
        !GENERIC_SKILL_VALUES.has(normalized) &&
        !/^(?:familiar|knowledgeable|proficient|experienced|experience)$/i.test(value)
    );
}

function parseSkills(sectionLines: string[] | undefined, knownSkills: string[]): string[] {
    const found = new Map<string, string>();
    const lines = sectionLines ?? [];
    const sectionText = lines.join(" ");

    for (const knownSkill of knownSkills) {
        if (containsKnownSkill(sectionText, knownSkill)) {
            found.set(knownSkill.toLowerCase(), knownSkill);
        }
    }

    for (const line of lines) {
        const pieces = line
            .split(/[,|;/]/)
            .map((piece) => piece.trim())
            .filter(Boolean);

        for (const piece of pieces) {
            const matchingKnownSkills = knownSkills.filter((skill) => containsKnownSkill(piece, skill));

            if (matchingKnownSkills.length > 0) {
                for (const knownSkill of matchingKnownSkills) {
                    found.set(knownSkill.toLowerCase(), knownSkill);
                }
                continue;
            }

            const skill = cleanSkillCandidate(piece);
            if (isUsefulSkillCandidate(skill)) {
                found.set(skill.toLowerCase(), skill);
            }
        }
    }

    return Array.from(found.values()).slice(0, 30);
}

function descriptionAfterDate(lines: string[], dateLineIndex: number): string | null {
    const descriptionLines: string[] = [];

    for (let index = dateLineIndex + 1; index < lines.length; index += 1) {
        const line = lines[index];

        if (!line || parseDateRange(line)) {
            break;
        }

        if (isSectionHeading(line)) {
            break;
        }

        if (descriptionLines.length >= 10) {
            break;
        }

        descriptionLines.push(line);
    }

    const description = descriptionLines.join("\n").trim();
    return description ? description.slice(0, 3_000) : null;
}

function parseWorkExperiences(lines: string[] | undefined): ResumePreview["workExperiences"] {
    if (!lines?.length) {
        return [];
    }

    const results: ResumePreview["workExperiences"] = [];

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (!line) continue;
        const range = parseDateRange(line);
        if (!range) continue;

        const linePrefix = line
            .slice(0, range.startIndex)
            .replace(/[|·•-]+$/g, "")
            .trim();
        const previous = lines[index - 1]?.trim() ?? "";
        const previousTwo = lines[index - 2]?.trim() ?? "";

        const companyName = linePrefix || previous;
        const jobTitle = linePrefix ? previous : previousTwo;

        if (!jobTitle || !companyName || parseDateRange(jobTitle) || parseDateRange(companyName)) {
            continue;
        }

        const key = `${jobTitle.toLowerCase()}|${companyName.toLowerCase()}|${range.startDate}`;
        if (
            results.some(
                (item) => `${item.jobTitle.toLowerCase()}|${item.companyName.toLowerCase()}|${item.startDate}` === key,
            )
        ) {
            continue;
        }

        results.push({
            jobTitle: jobTitle.slice(0, 120),
            companyName: companyName.slice(0, 120),
            location: null,
            startDate: range.startDate,
            endDate: range.endDate,
            isCurrent: range.isCurrent,
            description: descriptionAfterDate(lines, index),
        });

        if (results.length >= 10) {
            break;
        }
    }

    return results;
}

function parseSingleEducationYear(line: string): string | null {
    const normalized = line.trim();
    const match = normalized.match(/^(?:graduated\s+)?((?:19|20)\d{2})$/i);

    return match?.[1] ? `${match[1]}-01-01` : null;
}

function parseEducation(lines: string[] | undefined): ResumePreview["education"] {
    if (!lines?.length) {
        return [];
    }

    const results: ResumePreview["education"] = [];

    for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (!line) continue;
        const range = parseDateRange(line);
        if (!range) continue;

        const linePrefix = line
            .slice(0, range.startIndex)
            .replace(/[|·•-]+$/g, "")
            .trim();
        const institutionName = linePrefix || lines[index - 1]?.trim() || "";
        const degreeCandidate = linePrefix ? (lines[index - 1]?.trim() ?? "") : (lines[index - 2]?.trim() ?? "");

        if (!institutionName) {
            continue;
        }

        const fieldMatch = degreeCandidate.match(/\bin\s+(.+)$/i);
        const degree = degreeCandidate ? degreeCandidate.slice(0, 150) : null;
        const fieldOfStudy = fieldMatch?.[1]?.trim().slice(0, 150) ?? null;

        results.push({
            institutionName: institutionName.slice(0, 150),
            degree,
            fieldOfStudy,
            startDate: range.startDate,
            endDate: range.endDate,
            isCurrent: range.isCurrent,
            description: null,
        });

        if (results.length >= 8) {
            break;
        }
    }

    if (results.length === 0) {
        const institution = lines.find((line) => /university|college|school|institute|academy/i.test(line));
        if (institution) {
            const institutionIndex = lines.indexOf(institution);
            const nearbyLines = lines.slice(
                Math.max(0, institutionIndex - 3),
                Math.min(lines.length, institutionIndex + 4),
            );
            const range = nearbyLines.map(parseDateRange).find(Boolean) ?? null;
            const singleYear = nearbyLines.map(parseSingleEducationYear).find(Boolean) ?? null;
            const degreeCandidates = [
                lines[institutionIndex - 1],
                lines[institutionIndex + 1],
                lines[institutionIndex - 2],
                lines[institutionIndex + 2],
            ].filter((value): value is string => Boolean(value));
            const degree =
                degreeCandidates.find(
                    (value) =>
                        !parseDateRange(value) &&
                        !parseSingleEducationYear(value) &&
                        !/university|college|school|institute|academy/i.test(value),
                ) ?? null;

            results.push({
                institutionName: institution.slice(0, 150),
                degree: degree?.slice(0, 150) ?? null,
                fieldOfStudy:
                    degree
                        ?.match(/\bin\s+(.+)$/i)?.[1]
                        ?.trim()
                        .slice(0, 150) ?? null,
                startDate: range?.startDate ?? null,
                endDate: range ? range.endDate : singleYear,
                isCurrent: range?.isCurrent ?? false,
                description: null,
            });
        }
    }

    return results;
}

function parseCertifications(lines: string[] | undefined): ResumePreview["certifications"] {
    const results: ResumePreview["certifications"] = [];

    for (const line of lines ?? []) {
        if (line.length < 2 || line.length > 220 || parseDateRange(line)) {
            continue;
        }

        const parts = line
            .split(/\s+[|–—-]\s+/)
            .map((part) => part.trim())
            .filter(Boolean);
        const name = parts[0];

        if (!name || name.length > 150) {
            continue;
        }

        results.push({
            name,
            issuingOrganization: parts[1]?.slice(0, 150) ?? null,
            issueDate: null,
            expirationDate: null,
            credentialId: null,
            credentialUrl: null,
        });

        if (results.length >= 10) {
            break;
        }
    }

    return results;
}

function estimateYearsOfExperience(workExperiences: ResumePreview["workExperiences"]): number | null {
    if (workExperiences.length === 0) {
        return null;
    }

    const now = new Date();
    let months = 0;

    for (const item of workExperiences) {
        const start = new Date(item.startDate);
        const end = item.isCurrent || !item.endDate ? now : new Date(item.endDate);
        const diff = (end.getUTCFullYear() - start.getUTCFullYear()) * 12 + (end.getUTCMonth() - start.getUTCMonth());
        months += Math.max(0, diff);
    }

    return Math.min(60, Math.max(0, Math.round(months / 12)));
}

async function extractResumeText(
    fileKey: string,
    mimeType: string,
): Promise<{ text: string; sourceFormat: "PDF" | "DOCX" }> {
    const buffer = await getResumeObjectBuffer(fileKey);
    const extension = path.extname(fileKey).toLowerCase();

    if (mimeType === "application/pdf" || extension === ".pdf") {
        const parser = new PDFParse({ data: new Uint8Array(buffer), CanvasFactory });

        try {
            const result = await parser.getText();
            return { text: result.text, sourceFormat: "PDF" };
        } finally {
            await parser.destroy();
        }
    }

    if (
        mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        extension === ".docx"
    ) {
        const result = await mammoth.extractRawText({ buffer });
        return { text: result.value, sourceFormat: "DOCX" };
    }

    throw new AppError(
        400,
        "Profile import currently supports PDF and DOCX resumes. Legacy DOC files can still be stored and submitted, but should be saved as PDF or DOCX before importing profile data.",
    );
}

async function getOwnedResume(userId: string, resumeId: string) {
    const resume = await prisma.resume.findFirst({
        where: { id: resumeId, userId, deletedAt: null },
        select: { id: true, name: true, fileKey: true, mimeType: true },
    });

    if (!resume) {
        throw new AppError(404, "Resume not found.");
    }

    return resume;
}

export async function ensureResumeOwnedForProfileImport({ userId, resumeId }: { userId: string; resumeId: string }) {
    await getOwnedResume(userId, resumeId);
}

export async function previewResumeProfileImport({ userId, resumeId }: { userId: string; resumeId: string }) {
    const resume = await getOwnedResume(userId, resumeId);
    const extracted = await extractResumeText(resume.fileKey, resume.mimeType);
    const text = extracted.text.replace(/\u0000/g, " ").slice(0, MAX_RESUME_TEXT_CHARS);

    if (!text.trim()) {
        throw new AppError(
            422,
            "No readable text was found in this resume. Scanned/image-only PDFs may need OCR before JobsSpot can import profile data.",
        );
    }

    const lines = splitLines(text);
    const sections = getSections(lines);
    const name = parseName(lines);
    const contact = parseContact(lines);
    const excluded = new Set<string>();
    if (name.index >= 0) {
        const nameLine = lines[name.index];

        if (nameLine) {
            excluded.add(nameLine);
        }
    }
    if (contact.email) excluded.add(contact.email);
    if (contact.phone) excluded.add(contact.phone);

    const location = parseLocation(lines, excluded);
    if (location) excluded.add(location);
    const headline = parseHeadline(lines, name.index, excluded);

    const knownSkills = await prisma.skill.findMany({ select: { name: true }, orderBy: { name: "asc" }, take: 500 });
    const workExperiences = parseWorkExperiences(sections.experience);
    const education = parseEducation(sections.education);
    const certifications = parseCertifications(sections.certifications);
    const skills = parseSkills(
        sections.skills,
        knownSkills.map((skill) => skill.name),
    );

    const warnings: string[] = [
        "Resume details may not always be read perfectly. Check each suggestion before adding it to your profile.",
    ];

    if (extracted.sourceFormat === "PDF") {
        warnings.push("Resumes with columns, graphics, or scanned pages can be harder to read accurately.");
    }

    const preview: ResumePreview = {
        parser: {
            sourceFormat: extracted.sourceFormat,
            parserVersion: "LOCAL_HEURISTIC_V1",
            warnings,
        },
        personal: {
            firstName: name.firstName,
            lastName: name.lastName,
            detectedEmail: contact.email,
            phone: contact.phone,
            location,
        },
        professional: {
            headline,
            summary: parseSummary(sections.summary),
            websiteUrl: contact.websiteUrl,
            linkedInUrl: contact.linkedInUrl,
            yearsOfExperience: estimateYearsOfExperience(workExperiences),
        },
        skills,
        workExperiences,
        education,
        certifications,
    };

    return {
        resume: { id: resume.id, name: resume.name, mimeType: resume.mimeType },
        preview,
    };
}

function nullableDate(value: string | null | undefined): Date | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    return new Date(value);
}

function normalizeSkillName(name: string): string {
    return name.trim().replace(/\s+/g, " ");
}

export async function importResumeProfile({ userId, data }: { userId: string; data: ImportResumeProfileBody }) {
    const imported = await prisma.$transaction(
        async (transaction) => {
            const user = await transaction.user.findFirst({
                where: { id: userId, deletedAt: null },
                select: { id: true },
            });

            if (!user) {
                throw new AppError(404, "User not found.");
            }

            if (data.personal) {
                const userData: Prisma.UserUpdateInput = {};

                if (data.personal.firstName !== undefined && data.personal.firstName !== null)
                    userData.firstName = data.personal.firstName;
                if (data.personal.lastName !== undefined && data.personal.lastName !== null)
                    userData.lastName = data.personal.lastName;
                if (data.personal.phone !== undefined) userData.phone = data.personal.phone;

                if (Object.keys(userData).length > 0) {
                    await transaction.user.update({ where: { id: userId }, data: userData });
                }
            }

            const needsProfile =
                Boolean(data.professional) ||
                data.personal?.location !== undefined ||
                Boolean(data.skills?.length) ||
                Boolean(data.workExperiences?.length) ||
                Boolean(data.education?.length) ||
                Boolean(data.certifications?.length);

            let profileId: string | null = null;

            if (needsProfile) {
                const profile = await transaction.jobSeekerProfile.upsert({
                    where: { userId },
                    create: { userId },
                    update: {},
                    select: { id: true },
                });
                profileId = profile.id;
            }

            if (profileId && (data.professional || data.personal?.location !== undefined)) {
                const profileData: Prisma.JobSeekerProfileUpdateInput = {};

                if (data.personal?.location !== undefined) profileData.location = data.personal.location;
                if (data.professional?.headline !== undefined) profileData.headline = data.professional.headline;
                if (data.professional?.summary !== undefined) profileData.summary = data.professional.summary;
                if (data.professional?.websiteUrl !== undefined) profileData.websiteUrl = data.professional.websiteUrl;
                if (data.professional?.linkedInUrl !== undefined)
                    profileData.linkedInUrl = data.professional.linkedInUrl;
                if (data.professional?.yearsOfExperience !== undefined)
                    profileData.yearsOfExperience = data.professional.yearsOfExperience;

                if (Object.keys(profileData).length > 0) {
                    await transaction.jobSeekerProfile.update({ where: { id: profileId }, data: profileData });
                }
            }

            let skillsAdded = 0;
            if (profileId && data.skills?.length) {
                const existingCount = await transaction.jobSeekerSkill.count({ where: { profileId } });
                const remaining = Math.max(0, 30 - existingCount);

                if (remaining > 0) {
                    const requestedSkills = Array.from(
                        new Map(
                            data.skills
                                .map((requestedSkill) => normalizeSkillName(requestedSkill))
                                .filter(Boolean)
                                .map((name) => [createSlug(name), name] as const)
                                .filter(([slug]) => Boolean(slug)),
                        ).entries(),
                    ).map(([slug, name]) => ({ slug, name }));

                    if (requestedSkills.length > 0) {
                        await transaction.skill.createMany({
                            data: requestedSkills,
                            skipDuplicates: true,
                        });

                        const resolvedSkills = await transaction.skill.findMany({
                            where: { slug: { in: requestedSkills.map((skill) => skill.slug) } },
                            select: { id: true },
                        });

                        const existingLinks = resolvedSkills.length
                            ? await transaction.jobSeekerSkill.findMany({
                                  where: {
                                      profileId,
                                      skillId: { in: resolvedSkills.map((skill) => skill.id) },
                                  },
                                  select: { skillId: true },
                              })
                            : [];
                        const existingSkillIds = new Set(existingLinks.map((link) => link.skillId));
                        const skillLinks = resolvedSkills
                            .filter((skill) => !existingSkillIds.has(skill.id))
                            .slice(0, remaining)
                            .map((skill) => ({ profileId, skillId: skill.id }));

                        if (skillLinks.length > 0) {
                            const created = await transaction.jobSeekerSkill.createMany({
                                data: skillLinks,
                                skipDuplicates: true,
                            });
                            skillsAdded = created.count;
                        }
                    }
                }
            }

            let workExperiencesAdded = 0;
            if (profileId && data.workExperiences?.length) {
                for (const item of data.workExperiences) {
                    const startDate = new Date(item.startDate);
                    const existing = await transaction.workExperience.findFirst({
                        where: {
                            profileId,
                            jobTitle: { equals: item.jobTitle, mode: "insensitive" },
                            companyName: { equals: item.companyName, mode: "insensitive" },
                            startDate,
                        },
                        select: { id: true },
                    });
                    if (existing) continue;

                    await transaction.workExperience.create({
                        data: {
                            profileId,
                            jobTitle: item.jobTitle,
                            companyName: item.companyName,
                            location: item.location ?? null,
                            startDate,
                            endDate: item.isCurrent ? null : (nullableDate(item.endDate) ?? null),
                            isCurrent: item.isCurrent,
                            description: item.description ?? null,
                        },
                    });
                    workExperiencesAdded += 1;
                }
            }

            let educationAdded = 0;
            if (profileId && data.education?.length) {
                for (const item of data.education) {
                    const existing = await transaction.education.findFirst({
                        where: {
                            profileId,
                            institutionName: { equals: item.institutionName, mode: "insensitive" },
                            degree: item.degree ?? null,
                        },
                        select: { id: true },
                    });
                    if (existing) continue;

                    await transaction.education.create({
                        data: {
                            profileId,
                            institutionName: item.institutionName,
                            degree: item.degree ?? null,
                            fieldOfStudy: item.fieldOfStudy ?? null,
                            startDate: nullableDate(item.startDate) ?? null,
                            endDate: item.isCurrent ? null : (nullableDate(item.endDate) ?? null),
                            isCurrent: item.isCurrent,
                            description: item.description ?? null,
                        },
                    });
                    educationAdded += 1;
                }
            }

            let certificationsAdded = 0;
            if (profileId && data.certifications?.length) {
                for (const item of data.certifications) {
                    const existing = await transaction.certification.findFirst({
                        where: {
                            profileId,
                            name: { equals: item.name, mode: "insensitive" },
                            issuingOrganization: item.issuingOrganization ?? null,
                        },
                        select: { id: true },
                    });
                    if (existing) continue;

                    await transaction.certification.create({
                        data: {
                            profileId,
                            name: item.name,
                            issuingOrganization: item.issuingOrganization ?? null,
                            issueDate: nullableDate(item.issueDate) ?? null,
                            expirationDate: nullableDate(item.expirationDate) ?? null,
                            credentialId: item.credentialId ?? null,
                            credentialUrl: item.credentialUrl ?? null,
                        },
                    });
                    certificationsAdded += 1;
                }
            }

            return {
                skillsAdded,
                workExperiencesAdded,
                educationAdded,
                certificationsAdded,
            };
        },
        { timeout: MAX_IMPORT_TRANSACTION_MS },
    );

    return imported;
}
