//import { Resume } from "src/app/lib/redux/types";
import { JOB_ROLES, JobRole } from "src/app/data/jobRoles";
import { defaultResume } from "../src/electron/aiStore";
import axios from "axios";

export function normalizeGeminiResume(raw: any) {
  if (!raw) return { ...defaultResume };

  if (typeof raw === "string") {
    return {
      ...defaultResume,
      profile: { ...defaultResume.profile, name: raw, firstName: "", lastName: "" }
    };
  }

  const profileRaw = raw.profile ?? raw?.profile_data ?? raw;
  const profile = {
    firstName: profileRaw.firstName ?? profileRaw.first_name ?? profileRaw.first ?? "",
    middleName: profileRaw.middleName ?? profileRaw.middle_name ?? profileRaw.middle ?? "",
    lastName: profileRaw.lastName ?? profileRaw.last_name ?? profileRaw.last ?? "",
    email: profileRaw.email ?? profileRaw.email_address ?? "",
    phone: profileRaw.phone ?? profileRaw.phone_number ?? "",
    location: profileRaw.location ?? profileRaw.address ?? "",
    age: profileRaw.age ?? "",
    gender: profileRaw.gender ?? "",
    name: profileRaw.name ?? [profileRaw.firstName, profileRaw.middleName, profileRaw.lastName].filter(Boolean).join(" ") ?? ""
  };

  const educations = Array.isArray(raw.educations) ? raw.educations
    : Array.isArray(raw.education) ? raw.education
    : defaultResume.educations;

  const workExperiences = Array.isArray(raw.workExperiences) ? raw.workExperiences
    : Array.isArray(raw.work_experiences) ? raw.work_experiences
    : defaultResume.workExperiences;

  const projects = Array.isArray(raw.projects) ? raw.projects
    : Array.isArray(raw.project) ? raw.project
    : defaultResume.projects;

  const skills = raw.skills ?? raw.skill ?? defaultResume.skills;
  const custom = raw.custom ?? defaultResume.custom;

  return {
    profile,
    educations,
    workExperiences,
    projects,
    skills,
    custom
  };
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function parseRetryDelayFromError(err: any): Promise<number | null> {
  try {
    // Try HTTP header first
    const retryAfter = err?.response?.headers?.["retry-after"];
    if (retryAfter) {
      const asNum = parseFloat(retryAfter);
      if (!isNaN(asNum)) return asNum * 1000;
    }

    // Try Google API RetryInfo in response body (e.g. "retryDelay": "12s")
    const details = err?.response?.data?.error?.details;
    if (Array.isArray(details)) {
      const retryInfo = details.find((d: any) => d["@type"]?.includes("RetryInfo") || d["@type"]?.includes("retryinfo"));
      if (retryInfo?.retryDelay) {
        const m = String(retryInfo.retryDelay).match(/(\d+)(?:\.(\d+))?s/);
        if (m) {
          const secs = parseInt(m[1], 10);
          return secs * 1000;
        }
      }
    }
  } catch (_) {
    // ignore parse errors
  }
  return null;
}

export async function analyzeResumeWithDS(payload: {
  resume: string;
  job_role?: string;
  job_description?: string;
}, opts?: {maxRetries?: number}) {
  const maxRetries = opts?.maxRetries ?? 4;
  let attempt = 0;
  let backoff = 1000; // 1s initial


  while (true) {
    try {
      // Call your backend endpoint that forwards to Gemini
      const res = await axios.post("http://127.0.0.1:8000/ai/analyze-resume", payload, 
        { timeout: 120000,
          headers: { "Content-Type": "application/json" }
         });

         // Validate response
        if (!res.data) {
          throw new Error("Empty response from server");
        }

        if (res.data.error) {
          throw new Error(res.data.error);
        }

      return res.data;
    } catch (err: any) {
      attempt++;
      const status = err?.response?.status;
      // If rate limited (429) or server busy (503), try again with backoff
      if ((status === 429 || status === 503 || status === 504) && attempt <= maxRetries) {
        // Prefer server-suggested retry delay if present
        const suggested = await parseRetryDelayFromError(err);
        const wait = suggested ?? backoff;
        console.warn(`gemini server error: ${status}. retrying in ${wait}ms (attempt ${attempt}/${maxRetries})`);
        await sleep(wait);
        backoff *= 2; // exponential backoff
        continue;
      }
      // Otherwise rethrow
      throw new Error(
        err.response?.data?.error || 
        err.response?.data?.message || 
        err.message || 
        "Failed to analyze resume"
      );
    }
  }
}

export function generateResumeAnalysisPrompt(
  resume: string, 
  JobRoleObj?: JobRole, 
  jobDescription?: string) {
  let basePrompt = `
## Overall Assessment
[Provide a detailed & summarized assessment of the resume's overall quality, effectiveness, and alignment with industry standards. Include specific observations about formatting, content organization, and general impression. Be thorough and specific.]

## Skills Analysis
- **Current Skills**: [List ALL skills the candidate demonstrates in their resume, categorized by type (technical, soft, domain-specific, etc.). Be comprehensive.]
- **Skill Proficiency**: [Assess the apparent level of expertise in key skills based on how they're presented in the resume]
- **Missing Skills**: [List important skills that would improve the resume for their target role. Be specific and explain why each skill matters.]

## Experience Analysis
[Provide detailed feedback on how well the candidate has presented their experience. Analyze the use of action verbs, quantifiable achievements, and relevance to their target role. Suggest specific improvements. Afterwards, provide a score from 0-100 based on how well the experience section is presented: Resume Score: XX/100. Use this format exactly, where XX is the numerical score.]

## Key Strengths
[List 5-7 specific strengths of the resume with detailed explanations of why these are effective]

## Resume Score
[Provide a score from 0-100 based on the overall quality of the resume. Use this format exactly: "Resume Score: XX/100" where XX is the numerical score. Be consistent with your assessment - a resume with significant issues should score below 60, an average resume 60-75, a good resume 75-85, and an excellent resume 85-100.]

Resume Data:
${JSON.stringify(resume, null, 2)}
`;

  if (JobRoleObj) {
    basePrompt += `
The candidate is targeting a role as: ${JobRoleObj.description}

Required Skills for this Role:
${JobRoleObj.required_skills.join(", ")}

## Role Alignment Analysis
[Analyze how well the resume aligns with the target role. Provide specific recommendations to better align the resume with this role.]
`;
  }

  if (jobDescription) {
    basePrompt += `
Additionally, compare this resume to the following job description:

Job Description:
${jobDescription}

## Job Match Analysis
[Provide a detailed analysis of how well the resume matches the job description, with a match percentage and specific areas of alignment and misalignment]

## Key Job Requirements Not Met
[List specific requirements from the job description that are not addressed in the resume, with recommendations on how to address each gap]
`;
  }

  return basePrompt;
}