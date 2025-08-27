import { Resume } from "lib/redux/types";
import { JobRoles } from "data/jobRoles";

export function generateResumeAnalysisPrompt(resume: Resume, JobRoles?: string, jobDescription?: string) {
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

  if (JobRoles) {
    basePrompt += `
The candidate is targeting a role as: ${JobRoles}

## Role Alignment Analysis
[Analyze how well the resume aligns with the target role of ${JobRoles}. Provide specific recommendations to better align the resume with this role.]
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