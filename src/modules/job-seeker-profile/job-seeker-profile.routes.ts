import { Router } from "express";

import { asyncHandler } from "../../middleware/asyncHandler.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { validate } from "../../middleware/validate.js";

import {
    createCertification,
    getCertifications,
    removeCertification,
    updateCertification,
} from "./job-seeker-certification.controller.js";

import {
    createCertificationSchema,
    updateCertificationSchema,
} from "./job-seeker-certification.validation.js";

import {
    createEducation,
    getEducation,
    removeEducation,
    updateEducation,
} from "./job-seeker-education.controller.js";

import {
    createEducationSchema,
    updateEducationSchema,
} from "./job-seeker-education.validation.js";

import {
    addJobSeekerSkill,
    createWorkExperience,
    getJobSeekerProfile,
    getJobSeekerSkills,
    getWorkExperiences,
    removeJobSeekerSkill,
    removeWorkExperience,
    updateJobSeekerProfile,
    updateJobSeekerSkill,
    updateWorkExperience,
} from "./job-seeker-profile.controller.js";

import {
    addJobSeekerSkillSchema,
    createWorkExperienceSchema,
    updateJobSeekerProfileSchema,
    updateJobSeekerSkillSchema,
    updateWorkExperienceSchema,
} from "./job-seeker-profile.validation.js";

const jobSeekerProfileRouter = Router();

jobSeekerProfileRouter.use(asyncHandler(requireAuth));

// GET /api/job-seeker-profile
jobSeekerProfileRouter.get("/", asyncHandler(getJobSeekerProfile));

// PATCH /api/job-seeker-profile
jobSeekerProfileRouter.patch(
    "/",
    validate(updateJobSeekerProfileSchema),
    asyncHandler(updateJobSeekerProfile),
);

// GET /api/job-seeker-profile/skills
jobSeekerProfileRouter.get("/skills", asyncHandler(getJobSeekerSkills));

// POST /api/job-seeker-profile/skills
jobSeekerProfileRouter.post(
    "/skills",
    validate(addJobSeekerSkillSchema),
    asyncHandler(addJobSeekerSkill),
);

// PATCH /api/job-seeker-profile/skills/:skillId
jobSeekerProfileRouter.patch(
    "/skills/:skillId",
    validate(updateJobSeekerSkillSchema),
    asyncHandler(updateJobSeekerSkill),
);

// DELETE /api/job-seeker-profile/skills/:skillId
jobSeekerProfileRouter.delete(
    "/skills/:skillId",
    asyncHandler(removeJobSeekerSkill),
);

// GET /api/job-seeker-profile/work-experiences
jobSeekerProfileRouter.get(
    "/work-experiences",
    asyncHandler(getWorkExperiences),
);

// POST /api/job-seeker-profile/work-experiences
jobSeekerProfileRouter.post(
    "/work-experiences",
    validate(createWorkExperienceSchema),
    asyncHandler(createWorkExperience),
);

// PATCH /api/job-seeker-profile/work-experiences/:experienceId
jobSeekerProfileRouter.patch(
    "/work-experiences/:experienceId",
    validate(updateWorkExperienceSchema),
    asyncHandler(updateWorkExperience),
);

// DELETE /api/job-seeker-profile/work-experiences/:experienceId
jobSeekerProfileRouter.delete(
    "/work-experiences/:experienceId",
    asyncHandler(removeWorkExperience),
);

// GET /api/job-seeker-profile/education
jobSeekerProfileRouter.get(
    "/education",
    asyncHandler(getEducation),
);

// POST /api/job-seeker-profile/education
jobSeekerProfileRouter.post(
    "/education",
    validate(createEducationSchema),
    asyncHandler(createEducation),
);

// PATCH /api/job-seeker-profile/education/:educationId
jobSeekerProfileRouter.patch(
    "/education/:educationId",
    validate(updateEducationSchema),
    asyncHandler(updateEducation),
);

// DELETE /api/job-seeker-profile/education/:educationId
jobSeekerProfileRouter.delete(
    "/education/:educationId",
    asyncHandler(removeEducation),
);

// GET /api/job-seeker-profile/certifications
jobSeekerProfileRouter.get(
    "/certifications",
    asyncHandler(getCertifications),
);

// POST /api/job-seeker-profile/certifications
jobSeekerProfileRouter.post(
    "/certifications",
    validate(createCertificationSchema),
    asyncHandler(createCertification),
);

// PATCH /api/job-seeker-profile/certifications/:certificationId
jobSeekerProfileRouter.patch(
    "/certifications/:certificationId",
    validate(updateCertificationSchema),
    asyncHandler(updateCertification),
);

// DELETE /api/job-seeker-profile/certifications/:certificationId
jobSeekerProfileRouter.delete(
    "/certifications/:certificationId",
    asyncHandler(removeCertification),
);

export default jobSeekerProfileRouter;
