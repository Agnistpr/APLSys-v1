import { normalizeGeminiResume } from "../../../conn/genAnalysis";
import { useAnalysisStore, defaultResume } from "../../electron/aiStore";
/**
 * Persist NER parsing result into the global persisted store (renderer).
 * Normalizes raw backend output and writes into zustand persist store so results
 * survive unmount/hydration.
 */
export async function persistNERResult(nerResult: any, analysisText?: string) {
  try {
    if (!nerResult) throw new Error("Empty NER result");
    if (nerResult?.error) throw new Error(nerResult.error);

    const parsed = nerResult.parsed_entities || nerResult.parsedEntities || nerResult;
    if (!parsed || Object.keys(parsed).length === 0) {
      throw new Error("No parsed_entities found in NER result");
    }

    // Build a normalized profile
    const nameVal = (parsed.NAME && parsed.NAME[0]) || (parsed.PERSON_NAME && parsed.PERSON_NAME[0]) || "";
    const emailVal = (parsed.EMAIL && parsed.EMAIL[0]) || "";
    const phoneVal = (parsed.PHONE && parsed.PHONE[0]) || "";
    const locationVal = (parsed.ADDRESS && parsed.ADDRESS[0]) || (parsed.LOCATION && parsed.LOCATION[0]) || "";

    const profile: any = {
      name: nameVal,
      firstName: "",
      middleName: "",
      lastName: "",
      email: emailVal,
      phone: phoneVal,
      location: locationVal,
    };

    if (nameVal) {
      const parts = nameVal.trim().split(/\s+/);
      profile.firstName = parts[0] || "";
      profile.lastName = parts.length > 1 ? parts[parts.length - 1] : "";
      profile.middleName = parts.length > 2 ? parts.slice(1, -1).join(" ") : "";
    }

    // Map other sections (safe defaults)
    const mapped = {
      ...defaultResume,
      profile: { ...defaultResume.profile, ...profile },
      educations: (parsed.EDUCATION || []).map((e: string) => ({ school: e, degree: "", field: "", date: "" })),
      workExperiences: (parsed.EXPERIENCE || parsed.ORGANIZATION || []).map((v: string, i: number) => ({
        company: v,
        position: (parsed.JOB_TITLE && parsed.JOB_TITLE[i]) || "",
        date: (parsed.WORK_DATE && parsed.WORK_DATE[i]) || "",
        description: ""
      })),
      projects: (parsed.PROJECT || []).map((p: string) => ({ name: p, description: "", date: "" })),
      skills: {
        featuredSkills: parsed.SKILL || parsed.SKILLS || [],
        descriptions: parsed.SKILL_DESCRIPTION || []
      },
      custom: { descriptions: parsed.ACHIEVEMENT || [] }
    };

    const store = useAnalysisStore.getState();
    store.setEditableResume(mapped);
    store.setParsed(true);
    if (analysisText) store.setAnalysisResult(analysisText);

    // let subscribers/localStorage flush synchronously
    await new Promise(resolve => setTimeout(resolve, 0));

    console.log("DEBUG persistNERResult -> stored:", useAnalysisStore.getState().editableResume);
    return mapped;
  } catch (err) {
    console.error("persistNERResult failed:", err);
    const store = useAnalysisStore.getState();
    store.setEditableResume({ ...defaultResume });
    store.setParsed(false);
    throw err;
  }
}