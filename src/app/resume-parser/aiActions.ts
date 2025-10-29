import { normalizeGeminiResume } from "../../../conn/genAnalysis";
import { useAnalysisStore, defaultResume } from "../../electron/aiStore";
/**
 * Persist Gemini parsing result into the global persisted store (renderer).
 * Normalizes raw backend output and writes into zustand persist store so results
 * survive unmount/hydration.
 */
export async function persistGeminiResult(rawResult: any, analysisText?: string) {
  try {
    // Check for error response from Gemini
    if (rawResult?.error) {
      throw new Error(rawResult.error);
    }

    const normalized = (rawResult && rawResult.profile) ? rawResult : normalizeGeminiResume(rawResult);;

    const merged = {
      ...defaultResume,
      ...normalized,
      profile: { ...defaultResume.profile, ...(normalized?.profile || {}) },
      educations: normalized?.educations?.length ? normalized.educations : defaultResume.educations,
      workExperiences: normalized?.workExperiences?.length ? normalized.workExperiences : defaultResume.workExperiences,
      projects: normalized?.projects?.length ? normalized.projects : defaultResume.projects,
      skills: normalized?.skills ?? defaultResume.skills,
      custom: normalized?.custom ?? defaultResume.custom,
    };

    const store = useAnalysisStore.getState();
    store.setEditableResume(merged);
    store.setParsed(true);
    if (analysisText) store.setAnalysisResult(analysisText);

    // Ensure immediate caller who reads useAnalysisStore.getState() sees updates
    await new Promise(resolve => setTimeout(resolve, 0));

    console.log("DEBUG persistGeminiResult -> stored:", useAnalysisStore.getState().editableResume);
    return merged;
  } 
  catch (err)
  {
    console.error("persistGeminiResult failed:", err);
    // Initialize with empty resume on error
    const store = useAnalysisStore.getState();
    store.setEditableResume({...defaultResume});
    store.setParsed(false)
    throw err;
  }
}