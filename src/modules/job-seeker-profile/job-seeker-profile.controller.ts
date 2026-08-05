import type { Request, Response } from "express";
import { z } from "zod";

import { AppError } from "../../errors/AppError.js";

import {
    addUserJobSeekerSkill,
    createUserWorkExperience,
    deleteUserJobSeekerSkill,
    deleteUserWorkExperience,
    getUserJobSeekerProfile,
    listUserJobSeekerSkills,
    listUserWorkExperiences,
    updateUserJobSeekerProfile,
    updateUserJobSeekerSkill,
    updateUserWorkExperience,
} from "./job-seeker-profile.service.js";

import type {
    AddJobSeekerSkillBody,
    CreateWorkExperienceBody,
    UpdateJobSeekerProfileBody,
    UpdateJobSeekerSkillBody,
    UpdateWorkExperienceBody,
} from "./job-seeker-profile.validation.js";

const skillIdSchema = z.uuid();
const experienceIdSchema = z.uuid();

function getAuthenticatedUserId(request: Request): string {
    if (!request.user) {
        throw new AppError(401, "Authentication is required.");
    }

    return request.user.id;
}

function getSkillId(request: Request): string {
    const result = skillIdSchema.safeParse(request.params.skillId);

    if (!result.success) {
        throw new AppError(400, "A valid skill ID is required.");
    }

    return result.data;
}

function getExperienceId(request: Request): string {
    const result = experienceIdSchema.safeParse(
        request.params.experienceId,
    );

    if (!result.success) {
        throw new AppError(
            400,
            "A valid work experience ID is required.",
        );
    }

    return result.data;
}

export async function getJobSeekerProfile(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);

    const profile = await getUserJobSeekerProfile(userId);

    response.status(200).json({
        success: true,
        profile,
    });
}

export async function updateJobSeekerProfile(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    const body = request.body as UpdateJobSeekerProfileBody;

    const profile = await updateUserJobSeekerProfile({
        userId,
        data: body,
    });

    response.status(200).json({
        success: true,
        message: "Job seeker profile updated successfully.",
        profile,
    });
}

export async function getJobSeekerSkills(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);

    const skills = await listUserJobSeekerSkills(userId);

    response.status(200).json({
        success: true,
        skills,
    });
}

export async function addJobSeekerSkill(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    const body = request.body as AddJobSeekerSkillBody;

    const skill = await addUserJobSeekerSkill({
        userId,
        data: body,
    });

    response.status(201).json({
        success: true,
        message: "Skill added successfully.",
        skill,
    });
}

export async function updateJobSeekerSkill(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    const skillId = getSkillId(request);
    const body = request.body as UpdateJobSeekerSkillBody;

    const skill = await updateUserJobSeekerSkill({
        userId,
        skillId,
        data: body,
    });

    response.status(200).json({
        success: true,
        message: "Skill updated successfully.",
        skill,
    });
}

export async function removeJobSeekerSkill(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    const skillId = getSkillId(request);

    const result = await deleteUserJobSeekerSkill({
        userId,
        skillId,
    });

    response.status(200).json({
        success: true,
        message: "Skill removed successfully.",
        ...result,
    });
}

export async function getWorkExperiences(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);

    const workExperiences = await listUserWorkExperiences(userId);

    response.status(200).json({
        success: true,
        workExperiences,
    });
}

export async function createWorkExperience(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    const body = request.body as CreateWorkExperienceBody;

    const workExperience = await createUserWorkExperience({
        userId,
        data: body,
    });

    response.status(201).json({
        success: true,
        message: "Work experience added successfully.",
        workExperience,
    });
}

export async function updateWorkExperience(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    const experienceId = getExperienceId(request);
    const body = request.body as UpdateWorkExperienceBody;

    const workExperience = await updateUserWorkExperience({
        userId,
        experienceId,
        data: body,
    });

    response.status(200).json({
        success: true,
        message: "Work experience updated successfully.",
        workExperience,
    });
}

export async function removeWorkExperience(
    request: Request,
    response: Response,
): Promise<void> {
    const userId = getAuthenticatedUserId(request);
    const experienceId = getExperienceId(request);

    const result = await deleteUserWorkExperience({
        userId,
        experienceId,
    });

    response.status(200).json({
        success: true,
        message: "Work experience removed successfully.",
        ...result,
    });
}
