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

    // helpers
    const toStrArr = (v: any) =>
      Array.isArray(v) ? v.map(String).map(s => s.trim()).filter(Boolean) : (v ? [String(v).trim()] : []);

    const toTitleCase = (s: string) =>
      s
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean)
        .map(w => w.replace(/^\w/, (c) => c.toUpperCase()))
        .join(' ');

    // Pick best email (prefer item matching simple email regex)
    const emailCandidates = toStrArr(parsed.EMAIL || parsed.email || parsed.Mail);
    const emailVal =
      emailCandidates.find(e => /\S+@\S+\.\S+/.test(e)) ||
      emailCandidates[0] ||
      "";

    // Pick best phone (prefer one matching digits pattern)
    const phoneCandidates = toStrArr(parsed.PHONE || parsed.phone || parsed.Telephone);
    const phoneVal =
      phoneCandidates.find(p => /\+?\d[\d\-\s]{6,}\d/.test(p)) ||
      phoneCandidates[0] ||
      "";

    // Pick best name: prefer non-gender tokens, prefer Title Case or comma-format or multi-word candidates
    const rawNameCandidates = toStrArr(parsed.PERSON_NAME || parsed.NAME || parsed.person_name || parsed.name);
    const nameCandidates = rawNameCandidates.filter(n => !/^(male|female|m|f|unknown)$/i.test(n));
    let nameVal = "";
    if (nameCandidates.length > 0) {
      const titleCaseCandidate = nameCandidates.find(n => /[a-z]/.test(n)); // has lowercase -> likely Title Case
      const commaCandidate = nameCandidates.find(n => /,/.test(n));
      const multiWordCandidate = nameCandidates.find(n => n.split(/\s+/).length > 1);
      nameVal = titleCaseCandidate || commaCandidate || multiWordCandidate || nameCandidates[0];
    } else {
      nameVal = rawNameCandidates[0] || "";
    }

    // Normalize/parse name into parts (support "Last, First Middle" or "First Middle Last")
    const profile: any = {
      name: "",
      firstName: "",
      middleName: "",
      lastName: "",
      email: emailVal,
      phone: phoneVal,
      location: "",
    };

    if (nameVal) {
      const nv = nameVal.trim();
      if (/,/.test(nv)) {
        // "Last, First Middle"
        const [lastPart, rest] = nv.split(',', 2).map(s => s.trim());
        const restParts = (rest || "").split(/\s+/).filter(Boolean);
        profile.firstName = toTitleCase(restParts[0] || "");
        profile.middleName = restParts.length > 1 ? toTitleCase(restParts.slice(1).join(' ')) : "";
        profile.lastName = toTitleCase(lastPart);
        profile.name = toTitleCase(`${restParts.join(' ')} ${lastPart}`.trim());
      } else {
        const parts = nv.split(/\s+/).filter(Boolean);
        profile.firstName = toTitleCase(parts[0] || "");
        profile.lastName = toTitleCase(parts.length > 1 ? parts[parts.length - 1] : "");
        profile.middleName = parts.length > 2 ? toTitleCase(parts.slice(1, -1).join(' ')) : "";
        profile.name = toTitleCase(nv);
      }
    }

    const locationVal = (parsed.ADDRESS && parsed.ADDRESS[0]) || (parsed.LOCATION && parsed.LOCATION[0]) || "";
    if (locationVal) profile.location = toTitleCase(String(locationVal));

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
    // Write normalized resume + analysis into the persisted store
    if (typeof store.setEditableResume === "function") store.setEditableResume(mapped);
    if (analysisText && typeof store.setAnalysisResult === "function") store.setAnalysisResult(analysisText);
    if (typeof store.setParsed === "function") store.setParsed(true);

    // small delay to let zustand/persist middleware settle, then force-write to localStorage
    await new Promise((r) => setTimeout(r, 80));
    try {
      // Write current store snapshot into localStorage under the same key persist uses
      const key = "resume-analysis-store";
      const snapshot = useAnalysisStore.getState();
      try {
        // prefer persisted shape (zustand may wrap under { state: ... } so maintain compatibility)
        localStorage.setItem(key, JSON.stringify(snapshot));
      } catch (e) {
        // fallback: try wrapping
        try { localStorage.setItem(key, JSON.stringify({ state: snapshot })); } catch (_) {}
      }
    } catch (e) {
      console.warn("Failed to force-flush resume-analysis-store to localStorage:", e);
    }

    console.log("DEBUG persistNERResult -> stored:", useAnalysisStore.getState().editableResume);
    return mapped;
  } catch (err) {
    console.error("persistNERResult failed:", err);
    const store = useAnalysisStore.getState();
    if (typeof store.setEditableResume === "function") store.setEditableResume({ ...defaultResume });
    store.setParsed(false);
    throw err;
  }
}